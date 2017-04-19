#!/usr/bin/env babel-node --presets=es2017 --plugins=transform-object-rest-spread

// This script will download the a zip file and compute its hash.
//
// It should be run from the root of a cook-book folder.
// i.e. adjacent to "recipes"

const fs = require('fs');
const crypto = require('crypto');
const superagent = require('superagent');
const binaryParser = require('superagent-binary-parser');

const sha256 = x => crypto.createHash('sha256').update(x, 'utf8').digest('hex');

const glob = pattern => new Promise((resolve, reject) => require('glob')(pattern, (e, d) => {
  if (e) {
    reject(e);
  } else {
    resolve(d);
  }
}));

const readRecipe = path => new Promise((resolve, reject) => {
  fs.readFile(path, 'utf8', (e, d) => {
    if (e) {
      reject(e);
    } else {
      resolve(JSON.parse(d));
    }
  });
});

const writeFile = (path, content) => new Promise((resolve, reject) => {
  fs.writeFile(path, content, e => {
    if (e) {
      reject(e);
    } else {
      resolve();
    }
  })
});

const cache = {};

const fixVersion = async (version) => {
  if (!version.source || !version.source.url) {
    return version;
  }
  try {
    if (!cache[version.source.url]) {
      console.log('Downloading ' + version.source.url + '... ');
      const zip = await superagent.get(version.source.url).parse(binaryParser).buffer().send();
      console.log('Downloaded ' + version.source.url + '.');
      const hash = sha256(zip.body);
      console.log('sha256: ' + hash);
      cache[version.source.url] = hash;
    }
    return {
      ...version,
      source: {
        ...version.source,
        sha256: cache[version.source.url],
      }
    };
  } catch (error) {
    console.log('Failed!');
    console.log(error);
    console.log('Skipping this version... ');
    return version;
  }
};

const fixRecipe = async (recipe) => {
  let result = {...recipe};
  const entries = Object.entries(recipe.versions);
  for (const entry of entries) {
    result.versions[entry[0]] = await fixVersion(entry[1]);
  }
  return result;
};

async function main() {
  const files = await glob('recipes/*/*.json');
  const recipes = await Promise.all(files.map(async (x) => {
    const recipe = await readRecipe(x);
    return {
      path: x,
      data: recipe
    };
  }));
  for (const recipe of recipes) {
    const fixedRecipe = await fixRecipe(recipe.data);
    console.log('Writing ' + recipe.path + '... ');
    await writeFile(recipe.path, JSON.stringify(fixedRecipe, null, 2));
    console.log('Done.');
  }
  console.log('Done!');
}

main();
