import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
