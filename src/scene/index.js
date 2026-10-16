// Builds the whole diorama: a cut-away, Apple-store-minimal room with a desk and a MacBook.
// Everything is soft: rounded plan corners, bevelled edges, a filleted inner corner, a rounded window.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  woodTexture, stoneTexture, blobShadowTexture, rectShadowTexture,
  feltTexture, wallTexture, wallArtTexture, phoneScreenTexture, padScreenTexture,
} from './textures.js';
import { leafTexture, meshFabricTexture, photoTexture, lampGlowTexture, rugTexture2, noiseBump } from './textures2.js';
import {
  createMaterials, createDesk, createChair, createFiddlePlant, createFrame, createRug, createSideTable,
  createVase, createFloorLamp, createBench, createShelf, createPanel, roundedRectShape, slabGeo, smooth,
} from './props.js';
import {
  createMug, createMouse, createIPhone, createIPad, createAirPods, createHomePod, createDeskMat, createNotebook,
  createBooksStack, createSucculent, createHeadphones, createPhotoFrame, createCable,
} from './props-devices.js';
import { createMacBook } from './macbook.js';
import { createSkyMaterial } from './sky.js';
import { createDaylight } from './daylight.js';

const ROOM = { x0: -270, x1: 270, z0: -220, z1: 220, h: 290, t: 12 };
const DESK_TOP = 76.6;

export function createScene({ renderer, screenElement }) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();

  // ── image based light (soft reflections for aluminium / glass) ──
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.38;

  // ── textures + materials ──
  const { x0, x1, z0, z1, h, t } = ROOM;
  const slabW = x1 - x0, slabD = z1 - z0;

  const wallB = wallTexture({ corner: 'left', aniso });
  // left wall UVs are raw (z, y) in cm: map z −220…220 → 0…1 and y 0…290 → 0…1
  const wallL = wallTexture({ corner: 'left', aniso });
  wallL.wrapS = wallL.wrapT = THREE.ClampToEdgeWrapping;
  wallL.repeat.set(1 / slabD, 1 / h);
  wallL.offset.set(-z0 / slabD, 0);

  const oak = woodTexture({ base: '#ead8b8', dark: '#cdb48a', light: '#f6ead2', seed: 9, repeat: [1 / 180, 1 / 80], aniso });
  oak.offset.set(0.5, 0.5);
  const felt = feltTexture({ aniso });
  felt.repeat.set(1 / 34, 1 / 34);

  const tex = {
    floor: stoneTexture({ repeat: [1 / 120, 1 / 120], aniso }),
    oak,
    felt,
    rug: rugTexture2(),
    wallB,
    wallL,
    leaf: leafTexture(),
    noise: noiseBump(5),
    lampGlow: lampGlowTexture(),
    meshFabric: meshFabricTexture(),
  };
  tex.rug.anisotropy = aniso;
  const m = createMaterials(tex);

  const add = (obj, x = 0, y = 0, z = 0, ry = 0) => {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    scene.add(obj);
    return obj;
  };
  const solid = (geo, mat, x = 0, y = 0, z = 0, cast = true) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const rbox = (w, hh, d, r = 1.2) => new RoundedBoxGeometry(w, hh, d, 3, r);

  // ── floor slab: rounded plan corners + a soft bevel, top face = pale limestone ──
  {
    const geo = slabGeo(slabW + t, slabD + t, 14, 26, 2.2);
    solid(geo, [m.floor, m.plaster], -t / 2, -7, -t / 2);
  }

  // ── back wall (soft top edge) ──
  solid(rbox(slabW + t, h, t, 1.6), m.wallBack, -t / 2, h / 2, z0 - t / 2);

  // ── left wall: one extruded piece with a large rounded window opening ──
  const win = { w: 232, h: 180, r: 34, cz: -54, cy: 160 };
  {
    const bv = 1.0;
    const outer = new THREE.Shape();
    outer.moveTo(z0 + bv, bv);
    outer.lineTo(z1 - bv, bv);
    outer.lineTo(z1 - bv, h - bv);
    outer.lineTo(z0 + bv, h - bv);
    outer.closePath();
    outer.holes.push(roundedRectShape(win.w + 2 * bv, win.h + 2 * bv, win.r + bv, win.cz, win.cy));
    const depth = t - 2 * bv;
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 30,
    });
    geo.rotateY(-Math.PI / 2);
    geo.translate(x0 - bv, 0, 0);
    solid(smooth(geo), [m.wallLeft, m.plaster]);
  }

  // ── rounded inner corner: a vertical fillet where the two walls meet ──
  {
    const rf = 22;
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(rf, 0);
    s.absarc(rf, rf, rf, -Math.PI / 2, -Math.PI, true);
    s.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 28 });
    geo.rotateX(Math.PI / 2);
    geo.translate(x0, h, z0);
    solid(smooth(geo), m.wallCove);
  }

  // shadow-gap skirting with a hidden LED line (floating-wall look), curving round the corner
  {
    const rf = 22;
    const gap = new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 1 });
    solid(new THREE.BoxGeometry(slabW - rf, 2.4, 0.5), gap, (x0 + rf + x1) / 2, 1.2, z0 + 0.25, false);
    solid(new THREE.BoxGeometry(slabW - rf, 0.7, 0.4), m.led, (x0 + rf + x1) / 2, 3.0, z0 + 0.2, false);
    solid(new THREE.BoxGeometry(0.5, 2.4, slabD - rf), gap, x0 + 0.25, 1.2, (z0 + rf + z1) / 2, false);
    solid(new THREE.BoxGeometry(0.4, 0.7, slabD - rf), m.led, x0 + 0.2, 3.0, (z0 + rf + z1) / 2, false);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(rf - 0.1, 0.35, 8, 32, Math.PI / 2), m.led);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = Math.PI;
    arc.position.set(x0 + rf, 3.0, z0 + rf);
    scene.add(arc);
  }

  // thin graphite window frame (rounded ring) + a single mullion
  const wcz = win.cz, wcy = win.cy;
  {
    const fwid = 4.2, fdepth = 3.2;
    const ring = roundedRectShape(win.w + 2.4, win.h + 2.4, win.r + 1.2, wcz, wcy);
    ring.holes.push(roundedRectShape(win.w + 2.4 - 2 * fwid, win.h + 2.4 - 2 * fwid, win.r + 1.2 - fwid, wcz, wcy));
    const geo = new THREE.ExtrudeGeometry(ring, {
      depth: fdepth, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 2, curveSegments: 30,
    });
    geo.rotateY(-Math.PI / 2);
    geo.translate(x0 - 4.0, 0, 0);
    solid(smooth(geo), m.metal, 0, 0, 0, false);
    solid(rbox(2.4, win.h - 2 * fwid + 1, 2.2, 0.7), m.metal, x0 - 4.8, wcy, wcz, false);
  }

  // what you see outside
  const skyMat = createSkyMaterial(); // driven by the daylight system (uniforms only)
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(380, 250), skyMat);
  sky.position.set(x0 - 40, wcy + 8, wcz);
  sky.rotation.y = Math.PI / 2;
  scene.add(sky);

  // ── contact shadows ──
  const blob = blobShadowTexture(0.5);
  const rectSh = rectShadowTexture({ opacity: 0.4, inset: 0.16, blur: 0.14 });
  const contact = (map, w, d, x, z, y = 0.05, ry = 0, opacity = 1) => {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity, toneMapped: false })
    );
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = ry;
    p.position.set(x, y, z);
    p.renderOrder = 2;
    scene.add(p);
  };

  // ── rug first (everything below stands on it or beside it) ──
  const rugC = { x: -5, z: -100, R: 118 };
  add(createRug(m, rugC.R), rugC.x, 0, rugC.z);

  // ── furniture: only what belongs in an Apple space ──
  const deskX = 10, deskZ = -176;
  add(createDesk(m), deskX, 0, deskZ);
  contact(rectSh, 214, 104, deskX, deskZ + 2, 1.2, 0, 0.75);

  add(createChair(m), 40, 1.1, -104, Math.PI + 0.5);
  contact(blob, 100, 100, 40, -104, 1.2);

  add(createFiddlePlant(m), 160, 0, -186);
  contact(blob, 74, 74, 160, -186, 0.05);

  // round oak side table + a vase of dried stems
  add(createSideTable(m), 148, 0, -118);
  add(createVase(m), 148, 50, -118);
  contact(blob, 56, 56, 148, -118, 0.05);

  // slim floor lamp left of the desk
  const floorLamp = add(createFloorLamp(m), -118, 0, -198);
  // a real warm light in the globe (intensity driven by the daylight system / lamp.setOn)
  const lampLight = new THREE.PointLight(0xffb36b, 0, 0, 2);
  lampLight.position.set(0, 163, 0);
  floorLamp.add(lampLight);
  contact(blob, 44, 44, -118, -198, 0.05);

  // pill bench under the window
  add(createBench(m, { length: 140, width: 44 }), x0 + 40, 0, -40, Math.PI / 2);
  contact(rectSh, 96, 190, x0 + 40, -40, 0.05, 0, 0.8);

  // felt panel with the macOS wallpaper as art
  add(createPanel(m, { w: 236, h: 126, r: 30 }), deskX, 146, z0 + 1.2);
  add(createFrame(m, { w: 124, h: 82, tex: wallArtTexture() }), deskX, 146, z0 + 3.9);

  // floating oak shelf with a few objects, to the left of the panel
  add(createShelf(m, { length: 112, depth: 20 }), -200, 132, z0 + 10.2);

  // ── desk: the ecosystem, arranged calmly ──
  const MAT_T = 0.34; // desk-mat thickness
  add(createDeskMat(m), deskX + 22, DESK_TOP, deskZ + 16, 0.08);
  add(createIPad(m, padScreenTexture()), deskX - 54, DESK_TOP, deskZ - 2, 0.3);
  add(createIPhone(m, phoneScreenTexture()), deskX - 24, DESK_TOP, deskZ + 24, -0.32);
  add(createAirPods(m), deskX - 5, DESK_TOP, deskZ + 32, 0.5);
  add(createMouse(), deskX + 40, DESK_TOP + MAT_T, deskZ + 22, 0.1);
  add(createMug(m), deskX + 72, DESK_TOP, deskZ + 20);
  add(createHomePod(m), deskX + 76, DESK_TOP, deskZ - 20);
  // lived-in: notebook + pen, books, a succulent, headphones on a stand, a photo frame
  add(createNotebook(m), deskX - 62, DESK_TOP, deskZ + 20, 0.22);
  add(createBooksStack(m), deskX - 66, DESK_TOP, deskZ - 28, -0.12);
  add(createHeadphones(m), deskX + 46, DESK_TOP, deskZ - 30, -0.4);
  add(createSucculent(m), deskX + 64, DESK_TOP, deskZ - 24);
  add(createPhotoFrame(m, photoTexture(0)), deskX + 22, DESK_TOP, deskZ - 28, 0.12);
  contact(rectSh, 20, 27, deskX - 62, deskZ + 20, DESK_TOP + 0.06, 0.22, 0.7);
  contact(rectSh, 30, 36, deskX - 66, deskZ - 28, DESK_TOP + 0.06, -0.12, 0.7);
  contact(blob, 18, 18, deskX + 46, deskZ - 30, DESK_TOP + 0.06, 0, 0.8);
  contact(blob, 13, 13, deskX + 64, deskZ - 24, DESK_TOP + 0.06, 0, 0.8);
  contact(rectSh, 17, 8, deskX + 22, deskZ - 28, DESK_TOP + 0.06, 0.12, 0.7);
  contact(blob, 13, 13, deskX + 72, deskZ + 20, DESK_TOP + 0.06, 0, 0.7);
  contact(blob, 11, 11, deskX + 76, deskZ - 20, DESK_TOP + 0.06, 0, 0.7);

  // ── MacBook (on the desk mat) ──
  const mac = createMacBook({ screenElement, aniso });
  mac.group.position.set(deskX, DESK_TOP + MAT_T, deskZ + 4);
  mac.group.rotation.y = 0.3;
  scene.add(mac.group);
  contact(rectSh, 42, 34, deskX, deskZ + 4, DESK_TOP + MAT_T + 0.06, 0.3, 0.9);
  contact(rectSh, 66, 38, deskX + 22, deskZ + 16, DESK_TOP + 0.06, 0.08, 0.5);

  // USB-C cable from the MacBook's left port, slackly across the desk and down through the grommet
  mac.group.updateMatrixWorld(true);
  const port = mac.group.localToWorld(new THREE.Vector3(-15.55, 0.4, 3.0));
  const cy = DESK_TOP + MAT_T + 0.3;
  scene.add(createCable(m, [
    port, new THREE.Vector3(port.x - 5, cy, port.z + 1.2), new THREE.Vector3(port.x - 13, cy - 0.1, port.z - 4),
    new THREE.Vector3(deskX - 30, DESK_TOP + 0.25, deskZ - 14), new THREE.Vector3(deskX - 36, DESK_TOP + 0.22, deskZ - 24),
    new THREE.Vector3(deskX - 34, DESK_TOP - 0.2, deskZ - 29), new THREE.Vector3(deskX - 34, DESK_TOP - 2.8, deskZ - 29.2),
  ]));
  const plug = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.7, 1.2, 2, 0.3), m.silver);
  plug.position.set(port.x - 1.0, port.y, port.z);
  plug.rotation.y = mac.group.rotation.y;
  plug.castShadow = true;
  scene.add(plug);

  // ── ground shadow catcher (the "void" stays the page background) ──
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.26 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -14.1;
  ground.receiveShadow = true;
  scene.add(ground);

  const dropShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 760),
    new THREE.MeshBasicMaterial({
      map: rectShadowTexture({ opacity: 0.5, inset: 0.2, radius: 0.04, blur: 0.18 }),
      transparent: true, depthWrite: false, toneMapped: false,
    })
  );
  dropShadow.rotation.x = -Math.PI / 2;
  dropShadow.position.set(20, -14.05, 0);
  scene.add(dropShadow);

  // ── lights: clean daylight, no warm lamps ──
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.0);
  sun.position.set(-620, 420, 160);
  sun.target.position.set(0, 20, -60);
  sun.castShadow = true;
  const smap = renderer.capabilities.maxTextureSize >= 4096 && window.innerWidth >= 860 ? 4096 : 2048;
  sun.shadow.mapSize.set(smap, smap);
  const sc = sun.shadow.camera;
  sc.left = -520; sc.right = 520; sc.top = 420; sc.bottom = -420;
  sc.near = 100; sc.far = 1800;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xdcd8d0, 0.5);
  scene.add(hemi);

  const fill = new THREE.DirectionalLight(0xe6edff, 0.38);
  fill.position.set(500, 300, 600);
  scene.add(fill);

  // physical keyboard presses the 3D keys (visible whenever the camera looks at the laptop)
  mac.keys.bind();

  // time of day: sun/moon, sky, ambient light, tints, lamp, page background
  const daylight = createDaylight({
    scene, renderer, sun, hemi, fill, mats: m, skyMat, lampLight,
    sky: { center: sky.position.clone(), w: 380, h: 250 },
    target: sun.target.position,
  });

  /** Per-frame hook (called from the render loop with dt seconds, time, and the camera state). */
  const update = (dt) => {
    daylight.update(dt);
    mac.update(dt);
  };
  return { scene, mac, update, daylight, lights: { sun, fill, hemi, lamp: lampLight }, ROOM };
}
