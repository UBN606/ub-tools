const fs = require('fs');
const path = require('path');

const PAPERS_DIR = path.join(__dirname, 'source-texts', 'papers');
const INDEX_FILE = path.join(__dirname, 'source-texts', 'ub-search-index.json');

console.log('Building UB search index from all 196 papers...\n');

const index = {
  papers: [],
  totalParagraphs: 0,
  totalWords: 0,
  buildDate: new Date().toISOString()
};

// Process all papers
for (let i = 0; i <= 196; i++) {
  const filename = `Doc${String(i).padStart(3, '0')}.json`;
  const filepath = path.join(PAPERS_DIR, filename);
  
  if (!fs.existsSync(filepath)) continue;
  
  const paper = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  
  const paperEntry = {
    paper_index: paper.paper_index,
    paper_title: paper.paper_title || `Paper ${i}`,
    author: paper.author || 'Unknown',
    sections: [],
    paragraphCount: 0,
    wordCount: 0
  };
  
  if (paper.sections) {
    for (const section of paper.sections) {
      const sectionEntry = {
        section_index: section.section_index,
        section_ref: section.section_ref,
        section_title: section.section_title || '',
        paragraphs: []
      };
      
      if (section.pars) {
        for (const par of section.pars) {
          // Strip HTML tags from content
          const cleanContent = (par.par_content || '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x201[CD];/g, '"')
            .replace(/&#x2019;/g, "'")
            .trim();
          
          if (cleanContent) {
            sectionEntry.paragraphs.push({
              ref: par.par_ref,
              pageref: par.par_pageref,
              text: cleanContent
            });
            
            paperEntry.paragraphCount++;
            paperEntry.wordCount += cleanContent.split(/\s+/).length;
          }
        }
      }
      
      paperEntry.sections.push(sectionEntry);
    }
  }
  
  index.papers.push(paperEntry);
  index.totalParagraphs += paperEntry.paragraphCount;
  index.totalWords += paperEntry.wordCount;
  
  if (i % 20 === 0) {
    process.stdout.write(`  Paper ${i}...`);
  }
}

console.log('\n');
console.log(`Papers indexed: ${index.papers.length}`);
console.log(`Total paragraphs: ${index.totalParagraphs.toLocaleString()}`);
console.log(`Total words: ${index.totalWords.toLocaleString()}`);

// Write the full index
fs.writeFileSync(INDEX_FILE, JSON.stringify(index), 'utf8');
console.log(`\nIndex saved: ${INDEX_FILE}`);
console.log(`Index size: ${(fs.statSync(INDEX_FILE).size / 1024 / 1024).toFixed(1)} MB`);
