import type { ExamSession, GradeSummary, Settings, Sheet, StudyRecord, WrongNote } from '../types';
import { applyGradingToNotes, createStudyRecord, gradeExam } from '../utils/exam';
import { DEFAULT_SETTINGS, normalizeSettings } from '../utils/settings';

/**
 * 모든 데이터는 기기 안(IndexedDB)에만 저장한다. 서버 전송 없음.
 * 사진은 저장하지 않는다.
 *
 * 나중에 부모 계정/동기화를 붙일 때는 StorageBackend 구현만 추가하면 된다.
 */

export type StoreName = 'sheets' | 'wrongNotes' | 'records' | 'settings';

export interface StorageBackend {
  getAll<T>(store: StoreName): Promise<T[]>;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, key: string, value: T): Promise<void>;
  putMany<T>(store: StoreName, entries: [string, T][]): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
}

const DB_NAME = 'batssumon';
const DB_VERSION = 1;
const STORES: StoreName[] = ['sheets', 'wrongNotes', 'records', 'settings'];

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

export class IndexedDBBackend implements StorageBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = () => {
          const db = open.result;
          // 값과 키를 분리해 저장(out-of-line key) → 스키마 변경에 유연
          for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
        };
        open.onsuccess = () => {
          const db = open.result;
          db.onversionchange = () => db.close();
          resolve(db);
        };
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error('IndexedDB blocked'));
      });
      this.dbPromise.catch(() => {
        this.dbPromise = null;
      });
    }
    return this.dbPromise;
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.db();
    return req(db.transaction(store, 'readonly').objectStore(store).getAll()) as Promise<T[]>;
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.db();
    return req(db.transaction(store, 'readonly').objectStore(store).get(key)) as Promise<T | undefined>;
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    await this.putMany(store, [[key, value]]);
  }

  async putMany<T>(store: StoreName, entries: [string, T][]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const [k, v] of entries) os.put(v, k);
    await txDone(tx);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await txDone(tx);
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    await txDone(tx);
  }
}

/** 테스트용 / IndexedDB를 쓸 수 없는 환경용 메모리 저장소 */
export class MemoryBackend implements StorageBackend {
  private data = new Map<StoreName, Map<string, unknown>>();

  private s(store: StoreName) {
    let m = this.data.get(store);
    if (!m) {
      m = new Map();
      this.data.set(store, m);
    }
    return m;
  }

  // structuredClone으로 IndexedDB처럼 "복사본"을 저장/반환
  async getAll<T>(store: StoreName): Promise<T[]> {
    return [...this.s(store).values()].map((v) => structuredClone(v) as T);
  }
  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const v = this.s(store).get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    this.s(store).set(key, structuredClone(value));
  }
  async putMany<T>(store: StoreName, entries: [string, T][]): Promise<void> {
    for (const [k, v] of entries) this.s(store).set(k, structuredClone(v));
  }
  async delete(store: StoreName, key: string): Promise<void> {
    this.s(store).delete(key);
  }
  async clear(store: StoreName): Promise<void> {
    this.s(store).clear();
  }
}

export interface GradingOutcome {
  summary: GradeSummary;
  record: StudyRecord;
  changedNotes: WrongNote[];
}

export class StorageService {
  constructor(private backend: StorageBackend) {}

  // ---------- 급수표 ----------
  async listSheets(): Promise<Sheet[]> {
    const sheets = await this.backend.getAll<Sheet>('sheets');
    return sheets.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSheet(id: string): Promise<Sheet | undefined> {
    return this.backend.get<Sheet>('sheets', id);
  }

  async saveSheet(sheet: Sheet): Promise<Sheet> {
    const saved: Sheet = { ...sheet, updatedAt: Date.now() };
    await this.backend.put('sheets', saved.id, saved);
    return saved;
  }

  deleteSheet(id: string): Promise<void> {
    return this.backend.delete('sheets', id);
  }

  // ---------- 설정 ----------
  async getSettings(): Promise<Settings> {
    const raw = await this.backend.get<unknown>('settings', 'app');
    return raw ? normalizeSettings(raw) : { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.backend.put('settings', 'app', normalizeSettings(settings));
  }

  // ---------- 오답노트 / 학습 기록 ----------
  listWrongNotes(): Promise<WrongNote[]> {
    return this.backend.getAll<WrongNote>('wrongNotes');
  }

  deleteWrongNote(key: string): Promise<void> {
    return this.backend.delete('wrongNotes', key);
  }

  async listRecords(): Promise<StudyRecord[]> {
    const recs = await this.backend.getAll<StudyRecord>('records');
    return recs.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** 채점 결과 저장: 오답노트 갱신 + 학습 기록 추가 */
  async saveGradingResult(
    session: ExamSession,
    wrongKeys: ReadonlySet<string>,
    now = Date.now(),
  ): Promise<GradingOutcome> {
    const summary = gradeExam(session.items, wrongKeys);
    const existing = new Map((await this.listWrongNotes()).map((n) => [n.key, n] as const));
    const changedNotes = applyGradingToNotes(existing, session.items, wrongKeys, now);
    if (changedNotes.length > 0) {
      await this.backend.putMany(
        'wrongNotes',
        changedNotes.map((n) => [n.key, n] as [string, WrongNote]),
      );
    }
    const record = createStudyRecord(session, summary, now);
    await this.backend.put('records', record.id, record);
    return { summary, record, changedNotes };
  }

  /** 학습 기록·오답노트 초기화 (급수표와 설정은 유지) */
  async resetStudyData(): Promise<void> {
    await this.backend.clear('wrongNotes');
    await this.backend.clear('records');
  }
}

/**
 * IndexedDB를 우선 사용하고, 열 수 없으면(사생활 보호 모드 등) 메모리 저장소로 전환한다.
 * 앱이 저장소 문제로 멈추지 않게 하기 위함.
 */
export class ResilientBackend implements StorageBackend {
  private active: Promise<StorageBackend>;
  persistent = true;

  constructor() {
    this.active = this.init();
  }

  private async init(): Promise<StorageBackend> {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) throw new Error('no indexedDB');
      const idb = new IndexedDBBackend();
      await idb.get('settings', 'app'); // 실제로 열리는지 확인
      return idb;
    } catch {
      this.persistent = false;
      return new MemoryBackend();
    }
  }

  async isPersistent(): Promise<boolean> {
    await this.active;
    return this.persistent;
  }

  async getAll<T>(store: StoreName) {
    return (await this.active).getAll<T>(store);
  }
  async get<T>(store: StoreName, key: string) {
    return (await this.active).get<T>(store, key);
  }
  async put<T>(store: StoreName, key: string, value: T) {
    return (await this.active).put<T>(store, key, value);
  }
  async putMany<T>(store: StoreName, entries: [string, T][]) {
    return (await this.active).putMany<T>(store, entries);
  }
  async delete(store: StoreName, key: string) {
    return (await this.active).delete(store, key);
  }
  async clear(store: StoreName) {
    return (await this.active).clear(store);
  }
}

const appBackend = new ResilientBackend();

/** 앱 전체에서 사용하는 저장소 */
export const storage = new StorageService(appBackend);
export const isStoragePersistent = () => appBackend.isPersistent();

/** 브라우저가 저장 공간을 임의로 지우지 않도록 요청 (지원하는 경우) */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage && 'persist' in navigator.storage) {
      await navigator.storage.persist();
    }
  } catch {
    /* 무시 */
  }
}
