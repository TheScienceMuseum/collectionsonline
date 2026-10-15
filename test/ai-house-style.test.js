'use strict';

// Tests for lib/ai/house-style.js — the display-time safety net that
// folds repeated catalogue-title nouns and swaps American spellings in
// AI biography prose.

const test = require('tape');
const applyHouseStyle = require('../lib/ai/house-style');
const { foldRepeatedTitleNoun, britishSpelling } = applyHouseStyle;

// --- Repeated title noun ---------------------------------------------

test('foldRepeatedTitleNoun: folds the cases seen in the launch batch', function (t) {
  const cases = [
    [
      'The collection holds a reconstruction of {co207720|Reconstruction of Novelty Locomotive}, which incorporates original wheels.',
      'The collection holds a {co207720|reconstruction of Novelty Locomotive}, which incorporates original wheels.'
    ],
    [
      'The museum holds a working model of {co146940|Model of Jenning\'s patent water closet}, which is sectioned.',
      'The museum holds a working {co146940|model of Jenning\'s patent water closet}, which is sectioned.'
    ],
    [
      'It survives in a framed print, {co50905|Print of Henry Beighton\'s Engraving of a Newcomen Engine}.',
      'It survives in a framed {co50905|print of Henry Beighton\'s Engraving of a Newcomen Engine}.'
    ],
    [
      'A second model, {co119711|Model of binocular microscope by Cherubin d\'Orleans}, follows the same design.',
      'A second {co119711|model of binocular microscope by Cherubin d\'Orleans}, follows the same design.'
    ],
    [
      'The engraving {co420765|Engraving \'J Blenkinsop\'s Patent Steam Carriage\'} dates from 1812.',
      'The {co420765|engraving \'J Blenkinsop\'s Patent Steam Carriage\'} dates from 1812.'
    ],
    [
      'A box of {co181499|Box containing bottle of Peristaltin tablets}, made in Basel.',
      'A {co181499|box containing bottle of Peristaltin tablets}, made in Basel.'
    ],
    [
      'It includes a reproduction of the {co7186|Reproduction of the “Fountain of Fire” vacuum tube}.',
      'It includes a {co7186|reproduction of the “Fountain of Fire” vacuum tube}.'
    ]
  ];
  cases.forEach(function (c) { t.equal(foldRepeatedTitleNoun(c[0]), c[1]); });
  t.end();
});

test('foldRepeatedTitleNoun: keeps a capital when the dropped word opened the sentence', function (t) {
  t.equal(
    foldRepeatedTitleNoun('Model of {co1|Model of Rocket} is on display.'),
    '{co1|Model of Rocket} is on display.'
  );
  t.end();
});

test('foldRepeatedTitleNoun: leaves non-repeats alone', function (t) {
  const untouched = [
    // different noun before the marker
    'a 1:24 scale model, {co211462|Novelty model}, made around 1955',
    // plural vs singular — folding would break agreement ("two print of")
    'two prints, {co1|Print of the Rainhill Trials}',
    // repeated word is a proper name, not a descriptive title noun
    'the trials won by Rocket {co26704|Rocket locomotive}',
    // already folded by the writer
    'a working {co146940|model of Jenning\'s patent water closet}',
    // noun repeated but not directly before the marker
    'a model built by Bassett-Lowke, {co2|Model of Mallard}'
  ];
  untouched.forEach(function (s) { t.equal(foldRepeatedTitleNoun(s), s); });
  t.end();
});

// --- British spelling --------------------------------------------------

test('britishSpelling: fixes the slips seen in the launch batch', function (t) {
  t.equal(
    britishSpelling('Alberto Santos-Dumont was a Franco-Brazilian balloon and airplane aviator, born on 20 July 1873.'),
    'Alberto Santos-Dumont was a Franco-Brazilian balloon and aeroplane aviator, born on 20 July 1873.'
  );
  t.equal(
    britishSpelling('Its recorded products were airplanes, cars and engines.'),
    'Its recorded products were aeroplanes, cars and engines.'
  );
  t.end();
});

test('britishSpelling: swaps listed words and -ize / -yze forms', function (t) {
  t.equal(britishSpelling('a colored print'), 'a coloured print');
  t.equal(britishSpelling('the organization was reorganized'), 'the organisation was reorganised');
  t.equal(britishSpelling('he recognized and analyzed the samples'), 'he recognised and analysed the samples');
  t.equal(britishSpelling('a specialized center for pediatric care'), 'a specialised centre for paediatric care');
  t.equal(britishSpelling('the industrialization of the region'), 'the industrialisation of the region');
  t.equal(britishSpelling('travelers favored the faster route'), 'travellers favoured the faster route');
  t.end();
});

test('britishSpelling: never touches link text', function (t) {
  const s = 'Earlier products include {co8086583|Nintendo Color TV-Game 6 console, 1977} and {co1|Repro photo of Bristol Brabazon airplane}.';
  t.equal(britishSpelling(s), s);
  t.end();
});

test('britishSpelling: never touches quoted text', function (t) {
  t.equal(britishSpelling('his motto, “color is everything”, appears on the label'), 'his motto, “color is everything”, appears on the label');
  t.equal(britishSpelling('he called it ‘my favorite machine’ in 1910'), 'he called it ‘my favorite machine’ in 1910');
  t.equal(britishSpelling('the "airplane" label, and an airplane'), 'the "airplane" label, and an aeroplane');
  t.end();
});

test('britishSpelling: leaves capitalised words (proper nouns) alone', function (t) {
  const s = 'It is a member of the World Meteorological Organization and the Department of Defense.';
  t.equal(britishSpelling(s), s);
  t.end();
});

test('britishSpelling: leaves words that are British English in some sense alone', function (t) {
  const s = 'a computer program, a gas meter, licensed to practice, a dose of one gray, its size, seized and prized, the boat capsized, a resized life-size print';
  t.equal(britishSpelling(s), s);
  t.end();
});

// --- Combined -----------------------------------------------------------

test('applyHouseStyle: runs both passes; non-strings pass through', function (t) {
  t.equal(
    applyHouseStyle('A colored print, {co1|Print of the Rainhill Trials}.'),
    'A coloured {co1|print of the Rainhill Trials}.'
  );
  t.equal(applyHouseStyle(''), '');
  t.equal(applyHouseStyle(null), null);
  t.equal(applyHouseStyle(undefined), undefined);
  t.end();
});
