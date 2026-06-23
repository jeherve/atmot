import type { Lang } from './config.js';

/** UI copy, per language. Keys are stable; values are end-user facing. */
interface Strings {
  tagline: string;
  play: string;
  howToTitle: string;
  howTo: string[];
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
  sourceCode: string;
  profile: string;
}

const EN: Strings = {
  tagline: 'a daily word game on atproto',
  play: 'Play',
  howToTitle: 'How to play',
  howTo: [
    'Guess the 5-letter word in 6 tries.',
    'Each guess must be a real word.',
    'Tiles show how close you were: right letter & spot, right letter wrong spot, or not in the word.',
  ],
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
  sourceCode: 'Source code on tangled.org',
  profile: '@jeremy.herve.bzh on Bluesky',
};

const FR: Strings = {
  tagline: 'le mot du jour sur atproto',
  play: 'Jouer',
  howToTitle: 'Comment jouer',
  howTo: [
    'Devinez le mot de 5 lettres en 6 essais.',
    'Chaque proposition doit être un vrai mot.',
    'Les cases indiquent votre progression : bonne lettre bien placée, bonne lettre mal placée, ou absente du mot.',
  ],
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
  sourceCode: 'Code source sur tangled.org',
  profile: '@jeremy.herve.bzh sur Bluesky',
};

const TABLE: Record<Lang, Strings> = { en: EN, fr: FR };

export function t(lang: Lang): Strings {
  return TABLE[lang];
}
