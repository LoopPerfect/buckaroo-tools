#!/usr/bin/env babel-node --presets=es2017 --plugins=transform-object-rest-spread
// This script searches for recipes with buckfiles that use genrules and prints those to stdout
// It should be run from the root of a cook-book folder.
// i.e. adjacent to "recipes"

const fs = require('fs');
const superagent = require('superagent');



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

function getBuckFile(recipe) {
  const url = (Object
    .values(recipe.versions)[0]
    .buck||{}).url;

  if(url) {
    return superagent
      .get(url)
      .send()
      .then(x=>x.text);
  }
  return '';
}


async function main() {
  const files = await glob('recipes/*/*.json');
  const expr = /genrule/;

  const recipes = await Promise.all(files.map(async (path) => {
    const recipe = await readRecipe(path);
    const buckfile = await getBuckFile(recipe);
    return {
      path,
      buckfile,
      hasGenRule : buckfile.match(expr)
    };
  }));

  recipes
    .filter(x=>x.hasGenRule)
    .forEach(x=>console.log('##'+x.path+'##\n', x.buckfile, '##'+x.path+'##\n\n'))

  console.log(
    recipes
      .filter(x=>x.hasGenRule)
      .length,
      'have genrules'
  )


}

main().catch(e => {
  console.log(e);
});
