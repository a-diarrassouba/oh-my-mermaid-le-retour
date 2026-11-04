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
  'securityScore': 'Security score: {grade} ({score}/100)',
  'securityNone': 'Nothing found by the checks that ran.',
  'securitySeverity_critical': '{count} critical',
  'securitySeverity_high': '{count} high',
  'securitySeverity_medium': '{count} medium',
  'securitySeverity_low': '{count} low',
  'securityFiles': '{count} files read.',
  'securityIgnored': '{count} finding(s) left out by .prisme/security.yaml.',
  'securityMore': '… and {count} more in the report.',
  'securityTools': 'Tools: {tools}',
  'securityTool_ran': 'ran',
  'securityTool_missing': 'not installed',
  'securityTool_failed': 'failed',
  'securityTool_skipped': 'skipped',
  'securityReport': 'Report: {file}',
  'securityNext': 'Explanations and fixes: /prisme-security in Claude Code. In the viewer: prisme view.',
  'iconSet': 'icon of {path}: {icon}',
  'iconRemoved': 'icon of {path} removed',
  'explainWritten': 'wrote the explanations of {path}',
  'explainRefused': 'error: explanations of {path} refused, nothing written:',
  'aiWindows': 'questions to Claude are not available on Windows yet',
  'aiNotInstalled': 'Claude Code (the `claude` command) is not installed on this machine',
  'aiNotLoggedIn': 'Claude Code is not logged in on this machine: run `claude` in a terminal, then /login.',
  'aiNoAnswer': 'Claude did not answer',
  'aiNoAnswerDetail': 'Claude did not answer: {detail}',
  'aiTimeout': 'Claude took longer than 4 minutes',
  'aiInvalidTwice': 'Claude wrote a guide that is not valid, twice',
  'aiBusy': 'a question is already being answered',
  'aiNoSkill': 'the prisme-guide skill was not found next to this prisme',
  'aiOff': 'questions to Claude are turned off (prisme view --no-ai)',
  'viewerAiOn': 'Questions to Claude: on. Each one runs Claude Code on this machine (turn off with --no-ai).',
  'viewerAiOff': 'Questions to Claude: off (--no-ai).',
  'viewerForbidden': 'Forbidden: the viewer only answers at http://localhost:{port}/ or http://127.0.0.1:{port}/ on this machine.',
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
  'validateIcon': 'unknown icon "{icon}" in meta.yaml',
  'changesFull': 'Full scan recommended:',
  'changesPartial': 'Partial scan recommended:',
  'changesNone': 'Nothing to rescan:',
  'changesReasonNoElements': 'no documentation yet.',
  'changesReasonNotGit': 'the project is not a git repository.',
  'changesReasonNoPrevious': 'no previous scan recorded.',
  'changesReasonBaseMissing': 'the commit of the last scan is no longer in the history.',
  'changesReasonNoChanges': 'the code has not changed since the last scan.',
  'changesReasonTooMany': '{count} of {total} elements changed.',
  'changesReasonUndocumented': 'the changed files are not cited by any element.',
  'changesReasonSome': '{count} of {total} elements changed.',
  'changesBase': 'Last scan: commit {commit}.',
  'changesChanged': 'Elements to re-analyze ({count}):',
  'changesOrphans': 'New files no element covers ({count}):',
  'changesRemoved': 'Cited paths that no longer exist ({count}):',
  'changesOnboarding': 'Onboarding perspectives to review ({count}):',
  'changesGuides': 'Guides that walk through a changed element ({count}):',
  'changesMarked': 'Last scan recorded at commit {commit}.',
  'changesMarkFailed': 'error: cannot record the scan: the project is not a git repository with a commit.',
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
  prisme changes [--json | --mark]     What changed since the last scan (--mark records a scan)
  prisme security [--json] [--no-tools] Security score A–E, report in .prisme/.reports/
  prisme guide list|show|write|delete  Manage guides, step-by-step walks (.prisme/.guides/)
  prisme config [key] [value]          Read or set project settings (e.g. language fr)
  prisme view [--port <port>] [--no-ai] Start web viewer (default: 3000)


Paths: use / for nested elements (e.g. overall-architecture/main-process)
Fields: description, diagram, constraint, concern, context, todo, note
Title:  prisme write <path> title "Display name" (shown in the viewer instead of the id)
Icon:   prisme write <path> icon database (one word, see the prisme-scan skill)
Levels: prisme write <path> explain - (YAML on stdin: novice, deeper, junior)`,
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
  'securityScore': 'Score de sécurité : {grade} ({score}/100)',
  'securityNone': "Rien trouvé par les vérifications lancées.",
  'securitySeverity_critical': '{count} critique(s)',
  'securitySeverity_high': '{count} élevé(s)',
  'securitySeverity_medium': '{count} moyen(s)',
  'securitySeverity_low': '{count} faible(s)',
  'securityFiles': '{count} fichiers lus.',
  'securityIgnored': '{count} alerte(s) écartée(s) par .prisme/security.yaml.',
  'securityMore': '… et {count} autres dans le rapport.',
  'securityTools': 'Outils : {tools}',
  'securityTool_ran': 'lancé',
  'securityTool_missing': 'non installé',
  'securityTool_failed': 'en échec',
  'securityTool_skipped': 'ignoré',
  'securityReport': 'Rapport : {file}',
  'securityNext': 'Explications et corrections : /prisme-security dans Claude Code. Dans le viewer : prisme view.',
  'iconSet': 'icône de {path} : {icon}',
  'iconRemoved': 'icône de {path} supprimée',
  'explainWritten': 'explications de {path} écrites',
  'explainRefused': "erreur : explications de {path} refusées, rien n'a été écrit :",
  'aiWindows': 'les questions à Claude ne sont pas encore disponibles sous Windows',
  'aiNotInstalled': "Claude Code (la commande `claude`) n'est pas installé sur cette machine",
  'aiNotLoggedIn': "Claude Code n'est pas connecté sur cette machine : lancez `claude` dans un terminal, puis /login.",
  'aiNoAnswer': "Claude n'a pas répondu",
  'aiNoAnswerDetail': "Claude n'a pas répondu : {detail}",
  'aiTimeout': 'Claude a mis plus de 4 minutes',
  'aiInvalidTwice': "Claude a écrit deux fois un parcours qui n'est pas valide",
  'aiBusy': 'une question est déjà en cours',
  'aiNoSkill': "le skill prisme-guide est introuvable à côté de ce prisme",
  'aiOff': 'les questions à Claude sont désactivées (prisme view --no-ai)',
  'viewerAiOn': "Questions à Claude : activées. Chacune lance Claude Code sur cette machine (désactiver avec --no-ai).",
  'viewerAiOff': 'Questions à Claude : désactivées (--no-ai).',
  'viewerForbidden': "Interdit : le viewer ne répond qu'à http://localhost:{port}/ ou http://127.0.0.1:{port}/ sur cette machine.",
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
  'validateIcon': 'icône inconnue « {icon} » dans meta.yaml',
  'changesFull': 'Scan complet conseillé :',
  'changesPartial': 'Scan partiel conseillé :',
  'changesNone': 'Rien à réanalyser :',
  'changesReasonNoElements': 'aucune documentation pour le moment.',
  'changesReasonNotGit': "le projet n'est pas un dépôt git.",
  'changesReasonNoPrevious': 'aucun scan précédent enregistré.',
  'changesReasonBaseMissing': "le commit du dernier scan n'est plus dans l'historique.",
  'changesReasonNoChanges': "le code n'a pas changé depuis le dernier scan.",
  'changesReasonTooMany': '{count} éléments sur {total} ont changé.',
  'changesReasonUndocumented': 'les fichiers modifiés ne sont cités par aucun élément.',
  'changesReasonSome': '{count} éléments sur {total} ont changé.',
  'changesBase': 'Dernier scan : commit {commit}.',
  'changesChanged': 'Éléments à réanalyser ({count}) :',
  'changesOrphans': 'Nouveaux fichiers sans élément ({count}) :',
  'changesRemoved': "Chemins cités qui n'existent plus ({count}) :",
  'changesOnboarding': "Perspectives d'accueil à revoir ({count}) :",
  'changesGuides': 'Parcours qui traversent un élément modifié ({count}) :',
  'changesMarked': 'Dernier scan enregistré au commit {commit}.',
  'changesMarkFailed': "erreur : impossible d'enregistrer le scan : le projet n'est pas un dépôt git avec au moins un commit.",
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
  prisme changes [--json | --mark]     Ce qui a changé depuis le dernier scan (--mark enregistre un scan)
  prisme security [--json] [--no-tools] Score de sécurité A–E, rapport dans .prisme/.reports/
  prisme guide list|show|write|delete  Gérer les parcours guidés (.prisme/.guides/)
  prisme config [clé] [valeur]         Lire ou régler le projet (ex. : language fr)
  prisme view [--port <port>] [--no-ai] Lancer le viewer web (port 3000 par défaut)


Chemins : utilisez / pour les éléments imbriqués (ex. : overall-architecture/main-process)
Champs : description, diagram, constraint, concern, context, todo, note
Titre :  prisme write <chemin> title "Nom affiché" (montré dans le viewer à la place de l'identifiant)
Icône :  prisme write <chemin> icon database (un mot, voir le skill prisme-scan)
Niveaux : prisme write <chemin> explain - (YAML sur stdin : novice, deeper, junior)`,
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
