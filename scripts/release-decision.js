import { pathToFileURL } from 'node:url';

function parseFlag(value) {
  return value === true || value === 'true';
}

export function decideReleaseAction({
  currentVersion,
  previousVersion,
  npmPublished,
  tagExists,
  releaseExists,
  npmEnabled = true,
}) {
  const changed = currentVersion !== previousVersion;
  // Without npm publishing set up, the tag and the GitHub release are the whole release.
  const npmDone = !parseFlag(npmEnabled) || parseFlag(npmPublished);
  const artifactsComplete = npmDone && parseFlag(tagExists) && parseFlag(releaseExists);

  if (changed) {
    return {
      changed: true,
      shouldRelease: true,
      reason: 'version changed',
    };
  }

  if (!artifactsComplete) {
    return {
      changed: false,
      shouldRelease: true,
      reason: 'release artifacts missing for current version',
    };
  }

  return {
    changed: false,
    shouldRelease: false,
    reason: 'version unchanged and release artifacts already exist',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const decision = decideReleaseAction({
    currentVersion: process.env.RELEASE_CURRENT_VERSION ?? '',
    previousVersion: process.env.RELEASE_PREVIOUS_VERSION ?? '',
    npmPublished: process.env.RELEASE_NPM_PUBLISHED ?? 'false',
    tagExists: process.env.RELEASE_TAG_EXISTS ?? 'false',
    releaseExists: process.env.RELEASE_GITHUB_RELEASE_EXISTS ?? 'false',
    npmEnabled: process.env.RELEASE_NPM_ENABLED ?? 'true',
  });

  process.stdout.write(JSON.stringify(decision));
}
