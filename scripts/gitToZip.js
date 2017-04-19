#!/usr/bin/env babel-node --presets=es2017 --plugins=transform-object-rest-spread

// This script will find any recipe whose source is a GitHub git url
// and transform it into a GitHub zip url.
// It will also download the file to compute its hash.
//
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

const cache = {};

const fixVersion = async (version) => {
  if (!version.source || version.source.url || !version.source.startsWith('git@github.com')) {
    return version;
  }
  const owner = version.source.substr('git@github.com:'.length).split('/')[0];
  const project = version.source.substr('git@github.com:'.length).split('/')[1].split('.git')[0];
  const commit = version.source.split("#")[1];
  const url = 'https://github.com/' + owner + '/' + project + '/archive/' + commit + '.zip';
  console.log(version.source + ' -> ' + url);
  try {
    if (!cache[url]) {
      console.log('Downloading ' + url + '... ');
      const zip = await superagent.get(url).parse(binaryParser).buffer().send();
      console.log('Downloaded ' + url + '.');
      const hash = sha256(zip.body);
      console.log('sha256: ' + hash);
      cache[url] = hash;
    }
    return {
      ...version,
      source: {
        ...version.source,
        url,
        sha256: cache[url],
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
