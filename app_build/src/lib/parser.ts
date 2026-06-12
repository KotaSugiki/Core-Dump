import Parser from 'rss-parser';

export const parser = new Parser({
  customFields: {
    item: ['creator', 'dc:creator', 'category'],
  },
});
