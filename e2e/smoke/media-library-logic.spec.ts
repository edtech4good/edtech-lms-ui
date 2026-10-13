import { expect, test } from '@playwright/test';
import { FileType } from '../../src/app/models/enums/filetype.enum';
import {
  DEFAULT_DOCUMENT_LICENCE,
  DOCUMENT_LICENCES,
  LICENCE_OPTIONS,
  VIDEO_DOCUMENT_TYPE_ID,
  attributionFields,
  buildAttribution,
  documentLabel,
  documentTypeFilterValue,
  emptyMetadata,
  licenceLabel,
  licenceToSend,
  nextTitle,
  refusalMessage,
  titleFromFileName,
  updateBody,
  uploadFields,
} from '../../src/app/models/media-library';

/**
 * The media library's plain logic (src/app/models/media-library.ts), in Node: the licence list, the title a file
 * gets, what an upload sends, the label a document shows, the type filter's id. No browser, no API.
 */

// The same 21 ids as central's DOCUMENT_LICENCES (src/constants/media-library.ts), written out here so a one-sided
// change to the list is red in this repository.
const CENTRAL_LICENCES = [
  'CC0-1.0',
  'CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-2.0',
  'CC-BY-SA-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-2.0',
  'CC-BY-NC-4.0', 'CC-BY-NC-3.0', 'CC-BY-NC-2.0',
  'CC-BY-NC-SA-4.0', 'CC-BY-NC-SA-3.0', 'CC-BY-NC-SA-2.0',
  'CC-BY-ND-4.0', 'CC-BY-ND-3.0', 'CC-BY-ND-2.0',
  'CC-BY-NC-ND-4.0', 'CC-BY-NC-ND-3.0', 'CC-BY-NC-ND-2.0',
  'LicenseRef-all-rights-reserved',
  'unspecified',
];

const KHMER = 'ភ្នំពេញ';

test.describe('licences', () => {
  test('the list is central\'s 21 ids, in order, ending with the default', () => {
    expect(DOCUMENT_LICENCES).toEqual(CENTRAL_LICENCES);
    expect(DOCUMENT_LICENCES).toHaveLength(21);
    expect(DEFAULT_DOCUMENT_LICENCE).toBe('unspecified');
    expect(DOCUMENT_LICENCES[DOCUMENT_LICENCES.length - 1]).toBe(DEFAULT_DOCUMENT_LICENCE);
  });

  test('every id has one distinct label, and the select\'s values are the ids', () => {
    expect(LICENCE_OPTIONS.map((o) => o.value)).toEqual(CENTRAL_LICENCES);
    const labels = LICENCE_OPTIONS.map((o) => o.label);
    expect(new Set(labels).size).toBe(21);
    expect(licenceLabel('CC-BY-SA-4.0')).toBe('CC BY-SA 4.0');
    expect(licenceLabel('CC-BY-NC-ND-2.0')).toBe('CC BY-NC-ND 2.0');
    expect(licenceLabel('CC-BY-3.0')).toBe('CC BY 3.0');
    expect(licenceLabel('CC0-1.0')).toBe('CC0 1.0 (public domain)');
    expect(licenceLabel('LicenseRef-all-rights-reserved')).toBe('All rights reserved');
    expect(licenceLabel('unspecified')).toBe('Not recorded');
  });

  test('a cleared licence is sent as the default, a chosen one as its id', () => {
    expect(licenceToSend(null)).toBe('unspecified');
    expect(licenceToSend('')).toBe('unspecified');
    expect(licenceToSend('  ')).toBe('unspecified');
    expect(licenceToSend('CC0-1.0')).toBe('CC0-1.0');
  });
});

test.describe('the title a file gets', () => {
  test('is its name without the last extension, and nothing else is touched', () => {
    expect(titleFromFileName('ភ្នំពេញ.png')).toBe(KHMER);
    expect(titleFromFileName('Lesson 1. Counting.mp4')).toBe('Lesson 1. Counting');
    expect(titleFromFileName('archive.tar.gz')).toBe('archive.tar');
    expect(titleFromFileName('noextension')).toBe('noextension');
    expect(titleFromFileName('.hidden')).toBe('.hidden');
    expect(titleFromFileName('C:\\fakepath\\scan.PDF')).toBe('scan');
  });

  test('a file picked after the person typed a title leaves it alone; one picked after a prefill replaces it', () => {
    expect(nextTitle('', '', 'a.png')).toBe('a');
    expect(nextTitle('a', 'a', 'b.png')).toBe('b');
    expect(nextTitle('my own', 'a', 'b.png')).toBe('my own');
  });
});

test.describe('what an upload sends', () => {
  test('the title, the licence (always) and the attribution as JSON text with empty keys left out', () => {
    const meta = { ...emptyMetadata(), title: ` ${KHMER} `, licence: 'CC-BY-SA-4.0', author: ' Ana ', sourceurl: '', adaptedfrom: 'Source book' };
    expect(uploadFields(meta)).toEqual({
      documenttitle: KHMER,
      documentlicence: 'CC-BY-SA-4.0',
      documentattribution: JSON.stringify({ v: 1, author: 'Ana', adaptedfrom: 'Source book' }),
    });
  });

  test('nothing typed: no title, no attribution, and the default licence', () => {
    expect(uploadFields(emptyMetadata())).toEqual({ documentlicence: 'unspecified' });
    expect(uploadFields({ ...emptyMetadata(), licence: null })).toEqual({ documentlicence: 'unspecified' });
  });

  test('an attribution is null when every key is empty', () => {
    expect(buildAttribution({ author: ' ', sourceurl: '', adaptedfrom: '' })).toBeNull();
    expect(buildAttribution({ sourceurl: 'https://example.org/x' })).toEqual({ v: 1, sourceurl: 'https://example.org/x' });
  });

  test('the edit body clears the title and the attribution with null, and the licence with the default', () => {
    expect(updateBody({ ...emptyMetadata(), licence: null })).toEqual({
      documenttitle: null,
      documentlicence: 'unspecified',
      documentattribution: null,
    });
    expect(updateBody({ ...emptyMetadata(), title: 'T', licence: 'CC0-1.0', author: 'A' })).toEqual({
      documenttitle: 'T',
      documentlicence: 'CC0-1.0',
      documentattribution: { v: 1, author: 'A' },
    });
  });

  test('a stored attribution fills the form; anything unreadable is empty', () => {
    expect(attributionFields({ v: 1, author: 'A', sourceurl: 'https://e.org', adaptedfrom: 'B' })).toEqual({
      author: 'A',
      sourceurl: 'https://e.org',
      adaptedfrom: 'B',
    });
    expect(attributionFields(null)).toEqual({ author: '', sourceurl: '', adaptedfrom: '' });
    expect(attributionFields('x')).toEqual({ author: '', sourceurl: '', adaptedfrom: '' });
  });
});

test.describe('labels and filters', () => {
  test('a document is called its title, else its name', () => {
    expect(documentLabel({ documenttitle: KHMER, documentname: 'abc.png' })).toBe(KHMER);
    expect(documentLabel({ documenttitle: null, documentname: 'abc.png' })).toBe('abc.png');
    expect(documentLabel({ documentname: 'abc.png' })).toBe('abc.png');
    expect(documentLabel({ documenttitle: '   ', documentname: 'abc.png' })).toBe('abc.png');
    expect(documentLabel(null)).toBe('');
  });

  test('the file types 8 to 10 are named, and the type filter sends one exact id', () => {
    expect(FileType.SLIDES).toBe(8);
    expect(FileType.DOCUMENT).toBe(9);
    expect(FileType.SPREADSHEET).toBe(10);
    expect(FileType[8]).toBe('SLIDES');
    expect(FileType[9]).toBe('DOCUMENT');
    expect(FileType[10]).toBe('SPREADSHEET');
    expect(VIDEO_DOCUMENT_TYPE_ID).toBe(FileType.VIDEO);
    expect(documentTypeFilterValue('spreadsheet', FileType)).toBe('10');
    expect(documentTypeFilterValue(' Slides ', FileType)).toBe('8');
    expect(documentTypeFilterValue('AUDIO', FileType)).toBe('1');
    expect(documentTypeFilterValue('document', FileType)).toBe('9');
    expect(documentTypeFilterValue('nothing', FileType)).toBeNull();
    expect(documentTypeFilterValue('', FileType)).toBeNull();
    // the reverse entries of a numeric enum ('10' -> 'SPREADSHEET') are not names
    expect(documentTypeFilterValue('10', FileType)).toBeNull();
  });
});

test.describe('the refusal an upload shows', () => {
  test('the field messages if there are any, else the message, else a generic line', () => {
    expect(refusalMessage({ status: 400, error: { errormessage: "That file can't be used." } })).toBe("That file can't be used.");
    expect(
      refusalMessage({
        status: 400,
        error: { errormessage: "Some of the information isn't valid.", fields: [{ field: 'documenttitle', message: 'The title can be at most 255 characters.' }] },
      }),
    ).toBe('The title can be at most 255 characters.');
    expect(refusalMessage({ status: 403, error: {} })).toBe("You don't have permission to do that.");
    expect(refusalMessage(null)).toBe('That did not go through.');
  });
});
