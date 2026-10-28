import { getLanguage } from './language.js';

const en = {
  'error': 'error: {message}',
  'usage': 'error: usage: {usage}',
  'unknownCommand': "error: unknown command '{cmd}'. Run 'omm help' for usage.",
  'invalidPort': 'error: invalid port number',
  'invalidField': "error: invalid field '{field}'. Valid: {valid}",
  'elementNotFound': "error: element '{path}' not found",
  'fieldEmpty': 'error: {path} is empty',
  'ommCreated': 'Created .omm/ directory. Add to .gitignore if not wanted.',
  'ommAlreadyInitialized': '.omm/ already initialized.',
  'ommMissing': 'No .omm/ directory found. Run /omm-scan in Claude Code to generate architecture docs.',
  'noPerspectives': 'No perspectives found.',
  'noPerspectivesScan': 'No perspectives found. Run /omm-scan to generate.',
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
  'configWarnLanguage': "warning: '{value}' in .omm/config.yaml is not a language code, using {fallback}. Fix it with: omm config language fr",
  'configBadLanguage': "error: '{value}' is not a language code. Use a code such as fr, en, ko, ja, zh or pt-BR.",
  'configNotSet': '(not set)',
  'configSet': 'config: {key}={value}',
  'portInUse': 'Port {port} in use, trying {next}...',
  'viewerRunning': 'oh-my-mermaid viewer running at {url}',
  'guideStep': 'step {n}:',
  'guideNone': 'No guides yet. Write one with: omm guide write <id> < guide.yaml',
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
  omm guide list                List guides and whether they are valid
  omm guide show <id>           Print a guide and its validation
  omm guide write <id> [-]      Write a guide from YAML on stdin (refused if invalid)
  omm guide delete <id>         Delete a guide`,
  'help': `oh-my-mermaid (omm) — Architecture mirror for vibe coding

Usage:
  omm init                          Initialize .omm/ directory (usually not needed)
  omm setup [platform]              Register skills with AI coding tools
  omm setup --list                  Show detected platforms
  omm setup --teardown              Unregister from all platforms
  omm update                        Update CLI + plugins to latest version
  omm list                          List perspectives
  omm tree <path>                   Show element tree
  omm read <path> <field>           Read a field (stdout)
  omm write <path> <field> <text|-> Write a field
  omm show <path>                   Show all fields for an element
  omm delete <path>                 Delete an element
  omm status                        Show overview of all elements
  omm diff <path>                   Compare current vs previous diagram
  omm refs <path>                   Show elements that reference this element
  omm validate [path]               Validate diagram(s) and guides
  omm guide list|show|write|delete  Manage guides, step-by-step walks (.omm/.guides/)
  omm config [key] [value]          Read or set project settings (e.g. language fr)
  omm view [--port <port>]          Start web viewer (default: 3000)

Cloud:
  omm login                         Log in to omm.dev
  omm logout                        Log out
  omm link [org/slug]               Link project to a cloud slug
  omm push                          Push .omm/ to cloud
  omm pull                          Pull .omm/ from cloud
  omm share                         Print the shareable URL
  omm org list                      List your organizations
  omm org switch <slug>             Set default organization
  omm org members [slug]            View members (opens web)

Paths: use / for nested elements (e.g. overall-architecture/main-process)
Fields: description, diagram, constraint, concern, context, todo, note
Title:  omm write <path> title "Display name" (shown in the viewer instead of the id)`,
};

export type MessageKey = keyof typeof en;

const fr: Record<MessageKey, string> = {
  'error': 'erreur : {message}',
  'usage': 'erreur : utilisation : {usage}',
  'unknownCommand': "erreur : commande inconnue '{cmd}'. Lancez 'omm help' pour l'aide.",
  'invalidPort': 'erreur : numéro de port invalide',
  'invalidField': "erreur : champ invalide '{field}'. Champs possibles : {valid}",
  'elementNotFound': "erreur : élément '{path}' introuvable",
  'fieldEmpty': 'erreur : {path} est vide',
  'ommCreated': 'Dossier .omm/ créé. Ajoutez-le au .gitignore si vous ne voulez pas le versionner.',
  'ommAlreadyInitialized': '.omm/ existe déjà.',
  'ommMissing': "Aucun dossier .omm/ trouvé. Lancez /omm-scan dans Claude Code pour générer la documentation d'architecture.",
  'noPerspectives': 'Aucune perspective trouvée.',
  'noPerspectivesScan': 'Aucune perspective trouvée. Lancez /omm-scan pour en générer.',
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
  'configWarnLanguage': "avertissement : '{value}' dans .omm/config.yaml n'est pas un code de langue, {fallback} est utilisé. Corrigez avec : omm config language fr",
  'configBadLanguage': "erreur : '{value}' n'est pas un code de langue. Utilisez un code comme fr, en, ko, ja, zh ou pt-BR.",
  'configNotSet': '(non défini)',
  'configSet': 'config : {key}={value}',
  'portInUse': 'Le port {port} est occupé, essai du port {next}...',
  'viewerRunning': 'Viewer oh-my-mermaid lancé sur {url}',
  'guideStep': 'étape {n} :',
  'guideNone': 'Aucun parcours pour le moment. Écrivez-en un avec : omm guide write <id> < parcours.yaml',
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
  omm guide list                Lister les parcours et dire s'ils sont valides
  omm guide show <id>           Afficher un parcours et sa validation
  omm guide write <id> [-]      Écrire un parcours depuis du YAML sur l'entrée standard (refusé s'il est invalide)
  omm guide delete <id>         Supprimer un parcours`,
  'help': `oh-my-mermaid (omm) — le miroir de l'architecture de votre projet

Utilisation :
  omm init                          Créer le dossier .omm/ (rarement nécessaire)
  omm setup [plateforme]            Installer les skills dans les outils d'IA
  omm setup --list                  Voir les plateformes détectées
  omm setup --teardown              Désinstaller de toutes les plateformes
  omm update                        Mettre à jour le CLI et les plugins
  omm list                          Lister les perspectives
  omm tree <chemin>                 Afficher l'arbre des éléments
  omm read <chemin> <champ>         Lire un champ
  omm write <chemin> <champ> <texte|->  Écrire un champ
  omm show <chemin>                 Afficher tous les champs d'un élément
  omm delete <chemin>               Supprimer un élément
  omm status                        Vue d'ensemble des éléments
  omm diff <chemin>                 Comparer le diagramme actuel au précédent
  omm refs <chemin>                 Voir les éléments qui référencent cet élément
  omm validate [chemin]             Vérifier les diagrammes et les parcours
  omm guide list|show|write|delete  Gérer les parcours guidés (.omm/.guides/)
  omm config [clé] [valeur]         Lire ou régler le projet (ex. : language fr)
  omm view [--port <port>]          Lancer le viewer web (port 3000 par défaut)

Cloud :
  omm login                         Se connecter à omm.dev
  omm logout                        Se déconnecter
  omm link [org/slug]               Relier le projet à un slug cloud
  omm push                          Envoyer .omm/ vers le cloud
  omm pull                          Récupérer .omm/ depuis le cloud
  omm share                         Afficher le lien de partage
  omm org list                      Lister vos organisations
  omm org switch <slug>             Choisir l'organisation par défaut
  omm org members [slug]            Voir les membres (ouvre le site)

Chemins : utilisez / pour les éléments imbriqués (ex. : overall-architecture/main-process)
Champs : description, diagram, constraint, concern, context, todo, note
Titre :  omm write <chemin> title "Nom affiché" (montré dans le viewer à la place de l'identifiant)`,
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

/** A message in the project's language (.omm/config.yaml). */
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
