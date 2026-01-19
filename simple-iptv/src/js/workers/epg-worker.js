/**
 * EPG Worker
 * Parses XMLTV in background thread to avoid blocking UI
 */

// Simple SAX-style XML parser for XMLTV
// We parse incrementally to handle large files

const BATCH_SIZE = 500;
let programs = [];
let currentProgram = null;
let currentElement = '';
let currentChannelId = '';

/**
 * Parse XMLTV content
 * @param {string} xml 
 */
function parseXMLTV(xml) {
  programs = [];
  currentProgram = null;
  
  // Use regex-based parsing for simplicity and speed
  // Find all <programme> elements
  const programmeRegex = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi;
  let match;
  let count = 0;
  
  while ((match = programmeRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const content = match[2];
    
    const program = parseProgramme(attrs, content);
    if (program) {
      programs.push(program);
      count++;
      
      // Send batch
      if (programs.length >= BATCH_SIZE) {
        self.postMessage({ type: 'batch', data: [...programs] });
        programs = [];
      }
      
      // Report progress periodically
      if (count % 1000 === 0) {
        self.postMessage({ type: 'progress', data: { parsed: count } });
      }
    }
  }
  
  // Send remaining
  if (programs.length > 0) {
    self.postMessage({ type: 'batch', data: programs });
  }
  
  self.postMessage({ type: 'complete', data: { total: count } });
}

/**
 * Parse a single <programme> element
 * @param {string} attrs - Attribute string
 * @param {string} content - Inner content
 * @returns {Object|null}
 */
function parseProgramme(attrs, content) {
  // Parse attributes
  const start = parseAttr(attrs, 'start');
  const stop = parseAttr(attrs, 'stop');
  const channel = parseAttr(attrs, 'channel');
  
  if (!start || !channel) return null;
  
  // Parse content
  const title = parseElement(content, 'title');
  const desc = parseElement(content, 'desc');
  
  return {
    channelId: channel,
    title: title || 'Unknown',
    description: desc || '',
    start: parseXMLTVDate(start),
    end: stop ? parseXMLTVDate(stop) : parseXMLTVDate(start) + 3600000, // Default 1 hour
  };
}

/**
 * Parse attribute value from string
 * @param {string} str 
 * @param {string} name 
 * @returns {string|null}
 */
function parseAttr(str, name) {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = str.match(regex);
  return match ? match[1] : null;
}

/**
 * Parse element content
 * @param {string} xml 
 * @param {string} tag 
 * @returns {string|null}
 */
function parseElement(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? decodeXMLEntities(match[1].trim()) : null;
}

/**
 * Parse XMLTV date format: 20210101120000 +0000
 * @param {string} str 
 * @returns {number} - Unix timestamp in ms
 */
function parseXMLTVDate(str) {
  if (!str) return Date.now();
  
  // Remove timezone for simplicity (assume local/UTC)
  const clean = str.replace(/\s*[+-]\d{4}$/, '').trim();
  
  // Format: YYYYMMDDHHMMSS
  if (clean.length >= 14) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    const hour = clean.substring(8, 10);
    const minute = clean.substring(10, 12);
    const second = clean.substring(12, 14);
    
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    return date.getTime();
  }
  
  // Fallback: try native parsing
  const date = new Date(str);
  return isNaN(date.getTime()) ? Date.now() : date.getTime();
}

/**
 * Decode XML entities
 * @param {string} str 
 * @returns {string}
 */
function decodeXMLEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(num))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Fetch and parse XMLTV from URL
 * @param {string} url 
 */
async function loadFromUrl(url) {
  try {
    self.postMessage({ type: 'progress', data: { status: 'Fetching EPG...' } });
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    // Check content length for progress
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    self.postMessage({ type: 'progress', data: { status: 'Downloading...', total } });
    
    // Read as text
    const text = await response.text();
    
    self.postMessage({ type: 'progress', data: { status: 'Parsing EPG...', downloaded: text.length } });
    
    // Parse
    parseXMLTV(text);
    
  } catch (error) {
    self.postMessage({ type: 'error', data: { message: error.message } });
  }
}

// Message handler
self.onmessage = (e) => {
  const { type, url } = e.data;
  
  if (type === 'load' && url) {
    loadFromUrl(url);
  }
};
