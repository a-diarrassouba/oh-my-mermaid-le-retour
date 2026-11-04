import { getLanguage } from './language.js';

const en = {
  'error': 'error: {message}',
  'usage': 'error: usage: {usage}',
  'unknownCommand': "error: unknown command '{cmd}'. Run 'prisme help' for usage.",
  'invalidPort': 'error: invalid port number',
  'invalidField': "error: invalid field '{field}'. Valid: {valid}",
  'elementNotFound': "error: element '{path}' not found",
  'fieldEmpty': 'error: {path} is empty',
  'ommCreated': 'Created .prisme/ directory. Add to .gitignore if not wanted.',
  'ommAlreadyInitialized': '.prisme/ already initialized.',
  'ommMissing': 'No .prisme/ directory found. Run /prisme-scan in Claude Code to generate architecture docs.',
  'noPerspectives': 'No perspectives found.',
  'noPerspectivesScan': 'No perspectives found. Run /prisme-scan to generate.',
  'wrote': 'wrote {file} ({bytes} bytes)',
  'deleted': "deleted element '{path}'",
  'titleSet': 'title of {path}: {title}',
  'titleRemoved': 'title of {path} removed',
  'titleElementMissing': "element '{path}' not found. Write its description first.",
  'titleOneLine': 'a title must fit on one line',
  'titleTooLong': 'a title must be at most {max} characters',
  'statusCount': 'Perspectives: {count}',
  'statusUpdated.one': 'updated: {when} ({count} update)',
  'statusUpdated.other': 'updated: {when} ({count} updates)',
  'unknownDate': 'unknown',
  'noPreviousDiagram': "No previous diagram version for '{path}'.",
  'refsNone': '{path} does not reference any other element.',
  'refsOutgoing': '{path} references:',
  'refsNoIncoming': 'No element references {path}.',
  'refsIncoming': 'Referenced by:',
  'validateNoDiagram': '(no diagram)',
  'validateValid': '✓ valid',
  'validateInvalid': '✗ invalid',
  'errors.one': '{count} error',
  'errors.other': '{count} errors',
  'warnings.one': '{count} warning',
  'warnings.other': '{count} warnings',
  'validateLine': 'line {line}:',
  'configWarnLanguage': "warning: '{value}' in .prisme/config.yaml is not a language code, using {fallback}. Fix it with: prisme config language fr",
  'configBadLanguage': "error: '{value}' is not a language code. Use a code such as fr, en, ko, ja, zh or pt-BR.",
  'configNotSet': '(not set)',
  'configSet': 'config: {key}={value}',
  'portInUse': 'Port {port} in use, trying {next}...',
  'viewerRunning': 'prisme viewer running at {url}',
  'guideStep': 'step {n}:',
  'guideNone': 'No guides yet. Write one with: prisme guide write <id> < guide.yaml',
  'guideSteps.one': '{count} step',
  'guideSteps.other': '{count} steps',
  'guideParts.one': '{count} part',
  'guideParts.other': '{count} parts',
  'guideUnreadable': 'unreadable',
  'guideNotFound': "error: guide '{id}' not found",
  'guideIdRequired': 'error: give a guide id (lowercase letters, digits and dashes)',
  'guideStdin': 'error: the guide is read from stdin',
  'guideNotWritten': "error: guide '{id}' not written, fix the errors above",
  'guideWritten': "guide '{id}' written",
  'guideNeeded': "error: guide '{id}' not deleted: {ids} name it in \"after\"",
  'guideDeleted': "guide '{id}' deleted",
  'validateGuide': 'guide {id}:',
  'guideUsage': `usage:
  prisme guide list                List guides and whether they are valid
  prisme guide show <id>           Print a guide and its validation
  prisme guide write <id> [-]      Write a guide from YAML on stdin (refused if invalid)
  prisme guide delete <id>         Delete a guide`,
  'help': `prisme — understand any project, from beginner to senior developer

Usage:
  prisme init                          Initialize .prisme/ directory (usually not needed)
  prisme setup [platform]              Register skills with AI coding tools
  prisme setup --list                  Show detected platforms
  prisme setup --teardown              Unregister from all platforms
  prisme update                        Update CLI + plugins to latest version
  prisme list                          List perspectives
  prisme tree <path>                   Show element tree
  prisme read <path> <field>           Read a field (stdout)
  prisme write <path> <field> <text|-> Write a field
  prisme show <path>                   Show all fields for an element
  prisme delete <path>                 Delete an element
  prisme status                        Show overview of all elements
  prisme diff <path>                   Compare current vs previous diagram
  prisme refs <path>                   Show elements that reference this element
  prisme validate [path]               Validate diagram(s) and guides
  prisme guide list|show|write|delete  Manage guides, step-by-step walks (.prisme/.guides/)
  prisme config [key] [value]          Read or set project settings (e.g. language fr)
  prisme view [--port <port>]          Start web viewer (default: 3000)


Paths: use / for nested elements (e.g. overall-architecture/main-process)
Fields: description, diagram, constraint, concern, context, todo, note
Title:  prisme write <path> title "Display name" (shown in the viewer instead of the id)`,
};

export type MessageKey = keyof typeof en;

const fr: Record<MessageKey, string> = {
  'error': 'erreur : {message}',
  'usage': 'erreur : utilisation : {usage}',
  'unknownCommand': "erreur : commande inconnue '{cmd}'. Lancez 'prisme help' pour l'aide.",
  'invalidPort': 'erreur : numéro de port invalide',
  'invalidField': "erreur : champ invalide '{field}'. Champs possibles : {valid}",
  'elementNotFound': "erreur : élément '{path}' introuvable",
  'fieldEmpty': 'erreur : {path} est vide',
  'ommCreated': 'Dossier .prisme/ créé. Ajoutez-le au .gitignore si vous ne voulez pas le versionner.',
  'ommAlreadyInitialized': '.prisme/ existe déjà.',
  'ommMissing': "Aucun dossier .prisme/ trouvé. Lancez /prisme-scan dans Claude Code pour générer la documentation d'architecture.",
  'noPerspectives': 'Aucune perspective trouvée.',
  'noPerspectivesScan': 'Aucune perspective trouvée. Lancez /prisme-scan pour en générer.',
  'wrote': '{file} écrit ({bytes} octets)',
  'deleted': "élément '{path}' supprimé",
  'titleSet': 'titre de {path} : {title}',
  'titleRemoved': 'titre de {path} supprimé',
  'titleElementMissing': "élément '{path}' introuvable. Écrivez d'abord sa description.",
  'titleOneLine': 'un titre doit tenir sur une seule ligne',
  'titleTooLong': 'un titre doit faire au plus {max} caractères',
  'statusCount': 'Perspectives : {count}',
  'statusUpdated.one': 'mis à jour : {when} ({count} mise à jour)',
  'statusUpdated.other': 'mis à jour : {when} ({count} mises à jour)',
  'unknownDate': 'inconnue',
  'noPreviousDiagram': "Pas de version précédente du diagramme pour '{path}'.",
  'refsNone': "{path} ne référence aucun autre élément.",
  'refsOutgoing': '{path} référence :',
  'refsNoIncoming': "Aucun élément ne référence {path}.",
  'refsIncoming': 'Référencé par :',
  'validateNoDiagram': '(pas de diagramme)',
  'validateValid': '✓ valide',
  'validateInvalid': '✗ invalide',
  'errors.one': '{count} erreur',
  'errors.other': '{count} erreurs',
  'warnings.one': '{count} avertissement',
  'warnings.other': '{count} avertissements',
  'validateLine': 'ligne {line} :',
  'configWarnLanguage': "avertissement : '{value}' dans .prisme/config.yaml n'est pas un code de langue, {fallback} est utilisé. Corrigez avec : prisme config language fr",
  'configBadLanguage': "erreur : '{value}' n'est pas un code de langue. Utilisez un code comme fr, en, ko, ja, zh ou pt-BR.",
  'configNotSet': '(non défini)',
  'configSet': 'config : {key}={value}',
  'portInUse': 'Le port {port} est occupé, essai du port {next}...',
  'viewerRunning': 'Viewer prisme lancé sur {url}',
  'guideStep': 'étape {n} :',
  'guideNone': 'Aucun parcours pour le moment. Écrivez-en un avec : prisme guide write <id> < parcours.yaml',
  'guideSteps.one': '{count} étape',
  'guideSteps.other': '{count} étapes',
  'guideParts.one': '{count} partie',
  'guideParts.other': '{count} parties',
  'guideUnreadable': 'illisible',
  'guideNotFound': "erreur : parcours '{id}' introuvable",
  'guideIdRequired': 'erreur : donnez un identifiant de parcours (minuscules, chiffres et tirets)',
  'guideStdin': "erreur : le parcours se lit sur l'entrée standard",
  'guideNotWritten': "erreur : parcours '{id}' non écrit, corrigez les erreurs ci-dessus",
  'guideWritten': "parcours '{id}' écrit",
  'guideNeeded': "erreur : parcours '{id}' non supprimé : {ids} le cite dans \"after\"",
  'guideDeleted': "parcours '{id}' supprimé",
  'validateGuide': 'parcours {id} :',
  'guideUsage': `utilisation :
  prisme guide list                Lister les parcours et dire s'ils sont valides
  prisme guide show <id>           Afficher un parcours et sa validation
  prisme guide write <id> [-]      Écrire un parcours depuis du YAML sur l'entrée standard (refusé s'il est invalide)
  prisme guide delete <id>         Supprimer un parcours`,
  'help': `prisme — comprendre n'importe quel projet, du débutant au développeur confirmé

Utilisation :
  prisme init                          Créer le dossier .prisme/ (rarement nécessaire)
  prisme setup [plateforme]            Installer les skills dans les outils d'IA
  prisme setup --list                  Voir les plateformes détectées
  prisme setup --teardown              Désinstaller de toutes les plateformes
  prisme update                        Mettre à jour le CLI et les plugins
  prisme list                          Lister les perspectives
  prisme tree <chemin>                 Afficher l'arbre des éléments
  prisme read <chemin> <champ>         Lire un champ
  prisme write <chemin> <champ> <texte|->  Écrire un champ
  prisme show <chemin>                 Afficher tous les champs d'un élément
  prisme delete <chemin>               Supprimer un élément
  prisme status                        Vue d'ensemble des éléments
  prisme diff <chemin>                 Comparer le diagramme actuel au précédent
  prisme refs <chemin>                 Voir les éléments qui référencent cet élément
  prisme validate [chemin]             Vérifier les diagrammes et les parcours
  prisme guide list|show|write|delete  Gérer les parcours guidés (.prisme/.guides/)
  prisme config [clé] [valeur]         Lire ou régler le projet (ex. : language fr)
  prisme view [--port <port>]          Lancer le viewer web (port 3000 par défaut)


Chemins : utilisez / pour les éléments imbriqués (ex. : overall-architecture/main-process)
Champs : description, diagram, constraint, concern, context, todo, note
Titre :  prisme write <chemin> title "Nom affiché" (montré dans le viewer à la place de l'identifiant)`,
};

const CATALOGS: Record<string, Record<MessageKey, string>> = { en, fr };

/** The message in the given language (base language for `fr-CA`, English when missing). */
export function formatMessage(lang: string, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const catalog = CATALOGS[lang.toLowerCase().split('-')[0]] ?? en;
  return catalog[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** Picks the `.one` or `.other` form of a message for `count`, following the language's plural rules. */
export function pluralKey(lang: string, base: string, count: number): MessageKey {
  const form = new Intl.PluralRules(lang).select(count) === 'one' ? 'one' : 'other';
  return `${base}.${form}` as MessageKey;
}

let cachedLanguage: string | null = null;

function language(): string {
  cachedLanguage ??= getLanguage();
  return cachedLanguage;
}

/** A message in the project's language (.prisme/config.yaml). */
export function msg(key: MessageKey, vars?: Record<string, string | number>): string {
  return formatMessage(language(), key, vars);
}

/** A plural message in the project's language: `plural('errors', 2)` → "2 errors". */
export function plural(base: string, count: number, vars: Record<string, string | number> = {}): string {
  const lang = language();
  return formatMessage(lang, pluralKey(lang, base, count), { count, ...vars });
}

/** Dates in the project's language. */
export function formatDate(date: Date): string {
  return date.toLocaleString(language());
}
