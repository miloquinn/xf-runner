import { getDom } from "./ui/dom.js?v=20260616-1220";
import { Game } from "./core/game.js?v=20260616-1220";

const game = new Game(getDom());
game.start();

window.__xuefengRunner = game;
