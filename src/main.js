import { getDom } from "./ui/dom.js?v=20260615-1015";
import { Game } from "./core/game.js?v=20260615-1015";

const game = new Game(getDom());
game.start();

window.__xuefengRunner = game;
