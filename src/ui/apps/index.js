// Every app is a module that registers itself (registerApp). Import order = Dock order.
// Adding an app: create ./<id>.js, then add one import line here.
import './finder.js';
import './safari.js';
import './notes.js';
import './mail.js';
import './terminal.js';
import './settings.js';
import './welcome.js';
import '../games/index.js'; // games (category 'game') — not in the Dock, found through Spotlight / the Arcade

export { registerApp, getApp, listApps, resolve, listAliases } from './registry.js';
