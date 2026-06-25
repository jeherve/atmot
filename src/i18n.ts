import type { Lang } from './config.js';
import type { TileState } from './engine/types.js';

/** A worked example shown in the "How to play" modal: a sample word with one
 *  tile highlighted in a given state, plus a caption explaining that state. */
export interface HowToExample {
  word: string;
  /** Index (0–4) of the highlighted tile within `word`. */
  index: number;
  state: TileState;
  caption: string;
}

/** UI copy, per language. Keys are stable; values are end-user facing. */
interface Strings {
  tagline: string;
  play: string;
  howToTitle: string;
  howTo: string[];
  howToExamples: HowToExample[];
  helpOpen: string;
  helpClose: string;
  helpColorBlindHint: string;
  colorBlindMode: string;
  legendCorrect: string;
  legendPresent: string;
  legendAbsent: string;
  signIn: string;
  signInPrompt: string;
  signInPlaceholder: string;
  signInCta: string;
  signingIn: string;
  signOut: string;
  enterGuess: string;
  notInList: string;
  notEnough: string;
  alreadyPlayed: string;
  won: string;
  lost: string;
  theWordWas: string;
  shareToAtproto: string;
  shared: string;
  sharing: string;
  copyResult: string;
  copied: string;
  savedToPds: string;
  savingToPds: string;
  signInToSave: string;
  statsTitle: string;
  played: string;
  winPct: string;
  curStreak: string;
  maxStreak: string;
  guessDist: string;
  nextPuzzle: string;
  todaysResults: string;
  players: string;
  solved: string;
  avgGuesses: string;
  sharedGrids: string;
  noSharedYet: string;
  leaderboardEmpty: string;
  constellationDown: string;
  backToGame: string;
  langName: string;
  about: string;
  profile: string;
}

const EN: Strings = {
  tagline: 'a daily word game on atproto',
  play: 'Play',
  howToTitle: 'How to play',
  howTo: [
    'Guess the 5-letter word in 6 tries.',
    'Each guess must be a real word.',
    'After each guess, the tiles change colour to show how close you were.',
  ],
  howToExamples: [
    { word: 'CRANE', index: 0, state: 'correct', caption: 'C is in the word and in the right spot.' },
    { word: 'TABLE', index: 1, state: 'present', caption: 'A is in the word but in the wrong spot.' },
    { word: 'MOIST', index: 0, state: 'absent', caption: 'M is not in the word.' },
  ],
  helpOpen: 'How to play',
  helpClose: 'Close',
  helpColorBlindHint: 'Colour-blind? Turn on “Colour-blind mode” in the footer to add a symbol to each tile.',
  colorBlindMode: 'Colour-blind mode',
  legendCorrect: 'Right spot',
  legendPresent: 'Wrong spot',
  legendAbsent: 'Not in word',
  signIn: 'Sign in',
  signInPrompt: 'Sign in with your atproto handle to save your streak and share results.',
  signInPlaceholder: 'you.bsky.social or you.com',
  signInCta: 'Continue',
  signingIn: 'Redirecting…',
  signOut: 'Sign out',
  enterGuess: 'Type your guess',
  notInList: 'Not in word list',
  notEnough: 'Not enough letters',
  alreadyPlayed: 'You already played today',
  won: 'Solved!',
  lost: 'Out of guesses',
  theWordWas: 'The word was',
  shareToAtproto: 'Share to atproto',
  shared: 'Shared ✓',
  sharing: 'Sharing…',
  copyResult: 'Copy grid',
  copied: 'Copied ✓',
  savedToPds: 'Saved to your PDS ✓',
  savingToPds: 'Saving to your PDS…',
  signInToSave: 'Sign in to save & share',
  statsTitle: 'Your stats',
  played: 'Played',
  winPct: 'Win %',
  curStreak: 'Streak',
  maxStreak: 'Max streak',
  guessDist: 'Guess distribution',
  nextPuzzle: 'Next puzzle in',
  todaysResults: 'Results',
  players: 'players',
  solved: 'solved',
  avgGuesses: 'avg. guesses',
  sharedGrids: 'Shared on atproto',
  noSharedYet: 'No grids shared for this puzzle yet.',
  leaderboardEmpty: 'No results indexed yet for this puzzle.',
  constellationDown: 'Live stats are unavailable right now — the index may be catching up.',
  backToGame: 'Back to today’s game',
  langName: 'English',
  about: 'About',
  profile: '@jeremy.herve.bzh on Bluesky',
};

const FR: Strings = {
  tagline: 'le mot du jour sur atproto',
  play: 'Jouer',
  howToTitle: 'Comment jouer',
  howTo: [
    'Devinez le mot de 5 lettres en 6 essais.',
    'Chaque proposition doit être un vrai mot.',
    'Après chaque essai, les cases changent de couleur pour montrer votre progression.',
  ],
  howToExamples: [
    { word: 'PORTE', index: 0, state: 'correct', caption: 'Le P est dans le mot et bien placé.' },
    { word: 'TABLE', index: 1, state: 'present', caption: 'Le A est dans le mot mais mal placé.' },
    { word: 'MOULE', index: 0, state: 'absent', caption: 'Le M n’est pas dans le mot.' },
  ],
  helpOpen: 'Comment jouer',
  helpClose: 'Fermer',
  helpColorBlindHint: 'Daltonien ? Activez le « Mode daltonien » dans le pied de page pour ajouter un symbole à chaque case.',
  colorBlindMode: 'Mode daltonien',
  legendCorrect: 'Bien placée',
  legendPresent: 'Mal placée',
  legendAbsent: 'Absente',
  signIn: 'Se connecter',
  signInPrompt: 'Connectez-vous avec votre identifiant atproto pour enregistrer votre série et partager vos résultats.',
  signInPlaceholder: 'vous.bsky.social ou vous.fr',
  signInCta: 'Continuer',
  signingIn: 'Redirection…',
  signOut: 'Se déconnecter',
  enterGuess: 'Saisissez votre mot',
  notInList: 'Mot inconnu',
  notEnough: 'Pas assez de lettres',
  alreadyPlayed: 'Vous avez déjà joué aujourd’hui',
  won: 'Trouvé !',
  lost: 'Plus d’essais',
  theWordWas: 'Le mot était',
  shareToAtproto: 'Partager sur atproto',
  shared: 'Partagé ✓',
  sharing: 'Partage…',
  copyResult: 'Copier la grille',
  copied: 'Copié ✓',
  savedToPds: 'Enregistré sur votre PDS ✓',
  savingToPds: 'Enregistrement sur votre PDS…',
  signInToSave: 'Connectez-vous pour enregistrer et partager',
  statsTitle: 'Vos statistiques',
  played: 'Parties',
  winPct: '% de victoires',
  curStreak: 'Série',
  maxStreak: 'Série max',
  guessDist: 'Répartition des essais',
  nextPuzzle: 'Prochain mot dans',
  todaysResults: 'Résultats',
  players: 'joueurs',
  solved: 'résolu',
  avgGuesses: 'essais moy.',
  sharedGrids: 'Partagés sur atproto',
  noSharedYet: 'Aucune grille partagée pour ce mot pour l’instant.',
  leaderboardEmpty: 'Aucun résultat indexé pour ce mot pour l’instant.',
  constellationDown: 'Les statistiques en direct sont indisponibles — l’index est peut-être en train de rattraper son retard.',
  backToGame: 'Retour au mot du jour',
  langName: 'Français',
  about: 'À propos',
  profile: '@jeremy.herve.bzh sur Bluesky',
};

const TABLE: Record<Lang, Strings> = { en: EN, fr: FR };

export function t(lang: Lang): Strings {
  return TABLE[lang];
}
