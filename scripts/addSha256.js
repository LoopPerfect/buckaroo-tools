#!/usr/bin/env babel-node --presets=es2017 --plugins=transform-object-rest-spread

// This script will populate the sha256 field of every Buck file target.
// It should be run from the root of a cook-book folder.
// i.e. adjacent to "recipes"

const fs = require('fs');
const crypto = require('crypto');
const superagent = require('superagent');

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

const fixVersion = async (version) => {
  if (!version.buck || version.buck.sha256) {
    return version;
  }
  const buck = await superagent.get(version.buck.url).send();
  const hash = sha256(buck.text);
  return {
    ...version,
    buck: {
      ...version.buck,
      sha256: hash
    }
  };
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
      data: await fixRecipe(recipe)
    };
  }));
  for (const recipe of recipes) {
    console.log('Writing ' + recipe.path + '... ');
    await writeFile(recipe.path, JSON.stringify(recipe.data, null, 2));
  }
  console.log('Done!');
}

main();
