#!/usr/bin/env node
/** @format */

import { readProject } from '../packages/adapter-opencode/src/reader.ts';

const targetDir = process.argv[2] || process.cwd();
console.log(`Scanning agents in directory: ${targetDir}`);
const project = readProject(targetDir);
console.log(JSON.stringify(project, null, 2));
