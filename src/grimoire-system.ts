import {
  CanvasTexture,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  UIKitMLAsset,
  VisibilityState,
} from '@iwsdk/core';
import { Grimoire } from './grimoire-component.js';
import {
  LAST_PAGE,
  SCHOOLS,
  type CastState,
  type SchoolId,
  castCount,
  schoolForPage,
} from './grimoire-content.js';
import { paintLeftPage, paintRightPage } from './grimoire-paint.js';

const SAVE_KEY = 'aether-grimoire-save-v2';
const TURN_SECONDS = 0.48;

type SaveFile = {
  page: number;
  ember: boolean;
  gale: boolean;
  tide: boolean;
  veil: boolean;
  bound: boolean;
  days: string[];
};

type Pressable = Object3D & {
  addEventListener(
    type: 'pointerdown',
    listener: (event: { stopPropagation(): void }) => void,
  ): void;
  removeEventListener(
    type: 'pointerdown',
    listener: (event: { stopPropagation(): void }) => void,
  ): void;
};

type PanelText = {
  name: string;
  setProperties(props: { text?: string; display?: string }): void;
};

type PanelButton = PanelText & {
  addEventListener(type: 'click', listener: () => void): void;
  removeEventListener(type: 'click', listener: () => void): void;
};

/**
 * Seated, hands-first reading of Aether Grimoire.
 * A pinch or a poke on the gold corner turns a page. A pinch on the seal casts.
 */
export class GrimoireSystem extends createSystem({
  books: { required: [Grimoire] },
}) {
  private ready = false;
  private hinge!: Group;
  private halo!: Group;
  private rightMat!: MeshStandardMaterial;
  private leftMat!: MeshStandardMaterial;
  private rightTex!: CanvasTexture;
  private leftTex!: CanvasTexture;
  private rightCtx!: CanvasRenderingContext2D;
  private leftCtx!: CanvasRenderingContext2D;
  private sealMat!: MeshStandardMaterial;
  private nextMat!: MeshStandardMaterial;
  private prevMat!: MeshStandardMaterial;
  private stampMats: MeshStandardMaterial[] = [];
  private motes: Mesh[] = [];
  private turnSign = -1;
  private orbitSpeed = 0;
  private audio: AudioContext | undefined;
  private kicker: PanelText | undefined;
  private title: PanelText | undefined;
  private body: PanelText | undefined;

  init(): void {
    const bind = (entity: Entity) => this.bind(entity);
    const off = this.queries.books.subscribe('qualify', bind);
    this.cleanupFuncs.push(off);
    for (const entity of this.queries.books.entities) bind(entity);
  }

  update(delta: number, time: number): void {
    if (!this.ready) return;
    for (const entity of this.queries.books.entities) {
      if (entity.getValue(Grimoire, 'turning')) {
        const elapsed = (entity.getValue(Grimoire, 'turnElapsed') ?? 0) + delta;
        entity.setValue(Grimoire, 'turnElapsed', elapsed);
        const t = Math.min(1, elapsed / TURN_SECONDS);
        this.hinge.rotation.y = this.turnSign * Math.PI * smooth(t);
        if (t >= 1) {
          this.hinge.rotation.y = 0;
          entity.setValue(Grimoire, 'turning', false);
          entity.setValue(Grimoire, 'turnElapsed', 0);
          entity.setValue(
            Grimoire,
            'page',
            entity.getValue(Grimoire, 'turnTarget') ?? 0,
          );
          this.applyVisuals(entity);
          this.persist(entity);
        }
      } else {
        const page = entity.getValue(Grimoire, 'page') ?? 0;
        this.nextMat.emissiveIntensity =
          page < LAST_PAGE ? 0.4 + Math.sin(time * 3.1) * 0.28 : 0.06;
      }
      if (this.orbitSpeed > 0) this.halo.rotation.z += delta * this.orbitSpeed;
    }
  }

  private bind(entity: Entity): void {
    if (this.ready) return;
    const book = entity.object3D;
    if (!book) return;

    this.hinge = namedGroup(book, 'PageHinge');
    this.halo = namedGroup(book, 'Halo');
    const right = namedMesh(book, 'PageRight');
    const left = namedMesh(book, 'PageLeft');
    const seal = namedMesh(book, 'Control_Seal');
    const next = namedMesh(book, 'Control_Next');
    const prev = namedMesh(book, 'Control_Prev');

    this.rightMat = cloneStandard(right);
    this.leftMat = cloneStandard(left);
    this.sealMat = cloneStandard(seal);
    this.nextMat = cloneStandard(next);
    this.prevMat = cloneStandard(prev);
    right.material = this.rightMat;
    left.material = this.leftMat;
    seal.material = this.sealMat;
    next.material = this.nextMat;
    prev.material = this.prevMat;

    const rightPaint = makeCanvas();
    const leftPaint = makeCanvas();
    this.rightCtx = rightPaint.ctx;
    this.leftCtx = leftPaint.ctx;
    this.rightTex = rightPaint.texture;
    this.leftTex = leftPaint.texture;
    this.rightMat.map = this.rightTex;
    this.leftMat.map = this.leftTex;
    this.rightMat.color.set('#ffffff');
    this.leftMat.color.set('#ffffff');
    this.rightMat.roughness = 0.94;
    this.leftMat.roughness = 0.94;

    const stampNames = ['StampEmber', 'StampGale', 'StampTide', 'StampVeil'];
    this.stampMats = stampNames.map((name) => {
      const mesh = namedMesh(book, name);
      const material = cloneStandard(mesh);
      mesh.material = material;
      return material;
    });
    const moteNames = ['MoteEmber', 'MoteGale', 'MoteTide', 'MoteVeil'];
    this.motes = moteNames.map((name) => namedMesh(book, name));

    this.listen(next, () => this.requestTurn(entity, 1));
    this.listen(prev, () => this.requestTurn(entity, -1));
    this.listen(seal, () => this.cast(entity));
    this.bindPrompt();
    this.restore(entity);
    this.applyVisuals(entity);
    this.ready = true;
  }

  private listen(mesh: Mesh, onPress: () => void): void {
    const pressable = mesh as Pressable;
    const handler = (event: { stopPropagation(): void }) => {
      event.stopPropagation();
      onPress();
    };
    pressable.addEventListener('pointerdown', handler);
    this.cleanupFuncs.push(() =>
      pressable.removeEventListener('pointerdown', handler),
    );
  }

  private bindPrompt(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('prompt-panel');
    if (!panel) return;
    this.kicker = panel.getElementById('kicker') as PanelText | undefined;
    this.title = panel.getElementById('title') as PanelText | undefined;
    this.body = panel.getElementById('body') as PanelText | undefined;
    if (this.kicker) this.kicker.name = 'kicker';
    if (this.title) this.title.name = 'title';
    if (this.body) this.body.name = 'body';

    const xrButton = panel.getElementById('xr-button') as PanelButton | undefined;
    const exitButton = panel.getElementById('exit-button') as
      | PanelButton
      | undefined;
    if (!xrButton || !exitButton) return;
    xrButton.name = 'xr-button';
    exitButton.name = 'exit-button';
    const launch = () => this.world.launchXR();
    const leave = () => this.world.exitXR();
    xrButton.addEventListener('click', launch);
    exitButton.addEventListener('click', leave);
    const sync = (visibility: VisibilityState) => {
      const inSession = visibility !== VisibilityState.NonImmersive;
      xrButton.setProperties({ display: inSession ? 'none' : 'flex' });
      exitButton.setProperties({ display: inSession ? 'flex' : 'none' });
    };
    sync(this.world.visibilityState.value);
    const off = this.world.visibilityState.subscribe(sync);
    this.cleanupFuncs.push(
      () => xrButton.removeEventListener('click', launch),
      () => exitButton.removeEventListener('click', leave),
      off,
    );
  }

  private requestTurn(entity: Entity, direction: 1 | -1): void {
    if (!this.ready || entity.getValue(Grimoire, 'turning')) return;
    const page = entity.getValue(Grimoire, 'page') ?? 0;
    const target = page + direction;
    if (target < 0 || target > LAST_PAGE) {
      this.writePrompt(
        page,
        this.readState(entity),
        entity.getValue(Grimoire, 'stars') ?? 0,
        direction > 0 ? 'This is the last page.' : 'This is the first page.',
      );
      return;
    }
    this.turnSign = direction > 0 ? -1 : 1;
    entity.setValue(Grimoire, 'turning', true);
    entity.setValue(Grimoire, 'turnElapsed', 0);
    entity.setValue(Grimoire, 'turnTarget', target);
    this.playTone(direction > 0 ? [523] : [392], 0.04);
  }

  private cast(entity: Entity): void {
    if (!this.ready || entity.getValue(Grimoire, 'turning')) return;
    const page = entity.getValue(Grimoire, 'page') ?? 0;
    const state = this.readState(entity);
    const school = schoolForPage(page);
    if (!school) {
      if (page >= LAST_PAGE) {
        if (castCount(state) < 4) {
          this.writePrompt(
            page,
            state,
            entity.getValue(Grimoire, 'stars') ?? 0,
            'The binding stays shut until all four seals answer.',
          );
          this.playTone([110], 0.08);
          return;
        }
        entity.setValue(Grimoire, 'bound', true);
        this.playTone([262, 330, 392, 523], 0.12);
        this.applyVisuals(entity);
        this.persist(entity);
        return;
      }
      this.writePrompt(
        page,
        state,
        entity.getValue(Grimoire, 'stars') ?? 0,
        'Turn the gold corner before you cast.',
      );
      return;
    }
    this.setCast(entity, school.id, true);
    this.playTone(school.frequencies, 0.09);
    this.applyVisuals(entity);
    this.persist(entity);
  }

  private restore(entity: Entity): void {
    const saved = loadSave();
    const days = rememberToday(saved?.days ?? []);
    entity.setValue(Grimoire, 'stars', Math.min(7, days.length));
    if (!saved) {
      this.persist(entity);
      return;
    }
    const page = clampPage(saved.page);
    entity.setValue(Grimoire, 'page', page);
    entity.setValue(Grimoire, 'turnTarget', page);
    entity.setValue(Grimoire, 'emberCast', saved.ember);
    entity.setValue(Grimoire, 'galeCast', saved.gale);
    entity.setValue(Grimoire, 'tideCast', saved.tide);
    entity.setValue(Grimoire, 'veilCast', saved.veil);
    entity.setValue(Grimoire, 'bound', saved.bound && allSaved(saved));
  }

  private applyVisuals(entity: Entity): void {
    const page = entity.getValue(Grimoire, 'page') ?? 0;
    const state = this.readState(entity);
    const stars = entity.getValue(Grimoire, 'stars') ?? 0;
    paintRightPage(this.rightCtx, page, state);
    paintLeftPage(this.leftCtx, state, stars);
    this.rightTex.needsUpdate = true;
    this.leftTex.needsUpdate = true;

    const school = schoolForPage(page);
    const sealColor = state.bound
      ? '#fff4d2'
      : (school?.ink ?? '#e7c56a');
    this.sealMat.color.set(sealColor);
    this.sealMat.emissive.set(sealColor);
    this.sealMat.emissiveIntensity = state.bound ? 1.6 : school ? 0.9 : 0.35;
    this.prevMat.emissiveIntensity = page > 0 ? 0.28 : 0.05;

    SCHOOLS.forEach((entry, index) => {
      const on = state[entry.id];
      const stamp = this.stampMats[index];
      const mote = this.motes[index];
      if (!stamp || !mote) return;
      stamp.emissiveIntensity = on ? 1.15 : 0.05;
      mote.visible = on || state.bound;
      if (state.bound) mote.scale.setScalar(1.35);
    });
    this.orbitSpeed = state.bound ? 1.5 : castCount(state) > 0 ? 0.65 : 0;
    this.writePrompt(page, state, stars);
  }

  private writePrompt(
    page: number,
    state: CastState,
    stars: number,
    note?: string,
  ): void {
    const school = schoolForPage(page);
    const count = castCount(state);
    this.kicker?.setProperties({
      text: state.bound ? `AWAKE - STARS ${stars}` : `SEALS ${count}/4 - STARS ${stars}`,
    });
    if (page <= 0) {
      this.title?.setProperties({ text: 'Aether Grimoire' });
      this.body?.setProperties({
        text: note ?? 'Pinch the gold corner on the lower right to turn the page.',
      });
      return;
    }
    if (page >= LAST_PAGE) {
      this.title?.setProperties({ text: 'The Binding' });
      this.body?.setProperties({
        text:
          note ??
          (state.bound
            ? 'The book is awake. Return on a new day and it keeps another star.'
            : count === 4
              ? 'Pinch the seal. The four inks become one.'
              : 'Still shut. Ember, gale, tide, and veil must answer first.'),
      });
      return;
    }
    if (!school) return;
    this.title?.setProperties({ text: school.title });
    this.body?.setProperties({
      text: note ?? (state[school.id] ? `${school.title} already answers. The light stays.` : school.line),
    });
  }

  private readState(entity: Entity): CastState {
    return {
      ember: entity.getValue(Grimoire, 'emberCast') ?? false,
      gale: entity.getValue(Grimoire, 'galeCast') ?? false,
      tide: entity.getValue(Grimoire, 'tideCast') ?? false,
      veil: entity.getValue(Grimoire, 'veilCast') ?? false,
      bound: entity.getValue(Grimoire, 'bound') ?? false,
    };
  }

  private setCast(entity: Entity, id: SchoolId, value: boolean): void {
    if (id === 'ember') entity.setValue(Grimoire, 'emberCast', value);
    else if (id === 'gale') entity.setValue(Grimoire, 'galeCast', value);
    else if (id === 'tide') entity.setValue(Grimoire, 'tideCast', value);
    else entity.setValue(Grimoire, 'veilCast', value);
  }

  private persist(entity: Entity): void {
    const state = this.readState(entity);
    const previous = loadSave();
    const days = rememberToday(previous?.days ?? []);
    const save: SaveFile = {
      page: entity.getValue(Grimoire, 'page') ?? 0,
      ember: state.ember,
      gale: state.gale,
      tide: state.tide,
      veil: state.veil,
      bound: state.bound,
      days,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      // Private browsing can reject storage. The open book still works.
    }
  }

  private playTone(frequencies: number[], gain: number): void {
    const audio = this.ensureAudio();
    if (!audio) return;
    void audio.resume();
    frequencies.forEach((freq, index) => {
      const start = audio.currentTime + index * 0.03;
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(amp);
      amp.connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }

  private ensureAudio(): AudioContext | undefined {
    if (this.audio) return this.audio;
    const Ctx = window.AudioContext;
    if (!Ctx) return undefined;
    this.audio = new Ctx();
    this.cleanupFuncs.push(() => void this.audio?.close());
    return this.audio;
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function makeCanvas(): {
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Aether Grimoire could not paint a page');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return { ctx, texture };
}

function namedMesh(root: Object3D, name: string): Mesh {
  const found = root.getObjectByName(name);
  if (!found || !(found as Mesh).isMesh) {
    throw new Error(`Aether Grimoire is missing ${name}`);
  }
  return found as Mesh;
}

function namedGroup(root: Object3D, name: string): Group {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`Aether Grimoire is missing ${name}`);
  return found as Group;
}

function cloneStandard(mesh: Mesh): MeshStandardMaterial {
  const source = mesh.material;
  const material = Array.isArray(source) ? source[0] : source;
  if (!(material instanceof MeshStandardMaterial)) {
    throw new Error(`Aether Grimoire expected a standard material on ${mesh.name}`);
  }
  return material.clone();
}

function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 0;
  return Math.max(0, Math.min(LAST_PAGE, Math.floor(page)));
}

function todayKey(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function rememberToday(days: string[]): string[] {
  const today = todayKey();
  const unique = days.filter((day) => typeof day === 'string' && day.length > 0);
  if (!unique.includes(today)) unique.push(today);
  return unique.slice(-7);
}

function allSaved(save: SaveFile): boolean {
  return save.ember && save.gale && save.tide && save.veil;
}

function loadSave(): SaveFile | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    return {
      page: typeof parsed.page === 'number' ? parsed.page : 0,
      ember: parsed.ember === true,
      gale: parsed.gale === true,
      tide: parsed.tide === true,
      veil: parsed.veil === true,
      bound: parsed.bound === true,
      days: Array.isArray(parsed.days) ? parsed.days.filter((day) => typeof day === 'string') : [],
    };
  } catch {
    return undefined;
  }
}
