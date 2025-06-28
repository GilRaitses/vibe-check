const fs = require('fs');
const path = require('path');

// Improved file analysis with better pattern matching
function analyzeFileImproved(filename) {
  const upper = filename.toUpperCase();
  
  // Direct communication pairs with better matching
  const patterns = [
    // Earl-Phoenix communications
    { 
      pattern: /EARL.*PHOENIX|PHOENIX.*EARL/,
      pair: 'EARL_PHOENIX',
      supervisor: 'EARL',
      worker: 'PHOENIX'
    },
    // Duchess-Phoenix communications  
    {
      pattern: /DUCHESS.*PHOENIX|PHOENIX.*DUCHESS/,
      pair: 'DUCHESS_PHOENIX', 
      supervisor: 'DUCHESS',
      worker: 'PHOENIX'
    },
    // Earl-Duchess (peer level)
    {
      pattern: /EARL.*DUCHESS|DUCHESS.*EARL/,
      pair: 'EARL_DUCHESS',
      supervisor: 'EARL',
      worker: 'DUCHESS'
    },
    // Princess-Phoenix
    {
      pattern: /PRINCESS.*PHOENIX|PHOENIX.*PRINCESS/,
      pair: 'PRINCESS_PHOENIX',
      supervisor: 'PRINCESS', 
      worker: 'PHOENIX'
    },
    // Agent missions
    {
      pattern: /SCARLETT/,
      pair: 'SCARLETT_MISSION',
      supervisor: 'SYSTEM',
      worker: 'SCARLETT'
    },
    {
      pattern: /CHARLIE/,
      pair: 'CHARLIE_MISSION',
      supervisor: 'SYSTEM',
      worker: 'CHARLIE'
    }
  ];
  
  for (const p of patterns) {
    if (p.pattern.test(upper)) {
      return p;
    }
  }
  
  // Phase and project documents
  if (upper.includes('PHASE_')) {
    return { pair: 'PHASE_DOCS', supervisor: 'PROJECT', worker: 'SYSTEM' };
  }
  
  if (upper.includes('VALIDATION') && !upper.includes('EARL') && !upper.includes('DUCHESS')) {
    return { pair: 'VALIDATION_DOCS', supervisor: 'PROJECT', worker: 'SYSTEM' };
  }
  
  if (upper.includes('DEPLOYMENT') && !upper.includes('EARL') && !upper.includes('DUCHESS')) {
    return { pair: 'DEPLOYMENT_DOCS', supervisor: 'PROJECT', worker: 'SYSTEM' };
  }
  
  return { pair: 'PROJECT_DOCS', supervisor: 'PROJECT', worker: 'SYSTEM' };
}

function extractSubjectImproved(filename) {
  const upper = filename.toUpperCase();
  const subjects = [];
  
  // Primary action types
  if (upper.includes('EVALUATION') || upper.includes('EVAL')) subjects.push('EVAL');
  if (upper.includes('AUTHORIZATION') || upper.includes('AUTH')) subjects.push('AUTH');
  if (upper.includes('VALIDATION')) subjects.push('VALIDATION');
  if (upper.includes('REQUEST')) subjects.push('REQ');
  if (upper.includes('RESPONSE')) subjects.push('RESP');
  if (upper.includes('REPORT')) subjects.push('REPORT');
  if (upper.includes('CRITIQUE')) subjects.push('CRITIQUE');
  if (upper.includes('COMPLETION')) subjects.push('COMPLETE');
  if (upper.includes('MISSION') || upper.includes('BRIEF')) subjects.push('MISSION');
  if (upper.includes('CERTIFICATE') || upper.includes('CERT')) subjects.push('CERT');
  if (upper.includes('GUIDANCE')) subjects.push('GUIDE');
  if (upper.includes('STRATEGIC') || upper.includes('STRATEGY')) subjects.push('STRATEGY');
  if (upper.includes('INTEGRATION')) subjects.push('INTEGRATION');
  if (upper.includes('COORDINATION') || upper.includes('COORD')) subjects.push('COORD');
  if (upper.includes('ACCELERATION') || upper.includes('ACCEL')) subjects.push('ACCEL');
  if (upper.includes('CHECKPOINT')) subjects.push('CHECKPOINT');
  if (upper.includes('AUDIT')) subjects.push('AUDIT');
  if (upper.includes('MENTORSHIP') || upper.includes('MENTOR')) subjects.push('MENTOR');
  if (upper.includes('TRANSFORMATION') || upper.includes('TRANSFORM')) subjects.push('TRANSFORM');
  if (upper.includes('DEPLOYMENT') || upper.includes('DEPLOY')) subjects.push('DEPLOY');
  
  // Time markers
  if (upper.includes('6HOUR') || upper.includes('6H')) subjects.push('6H');
  if (upper.includes('18HOUR') || upper.includes('18H')) subjects.push('18H');
  if (upper.includes('DAY2') || upper.includes('D2')) subjects.push('D2');
  
  // Phase markers
  if (upper.includes('PHASE_4') || upper.includes('P4')) subjects.push('P4');
  else if (upper.includes('PHASE_3') || upper.includes('P3')) subjects.push('P3');
  else if (upper.includes('PHASE_2') || upper.includes('P2')) subjects.push('P2');
  else if (upper.includes('PHASE_1') || upper.includes('P1')) subjects.push('P1');
  
  return subjects.length > 0 ? subjects.join('_') : 'GENERAL';
}

async function executeRenames() {
  const correspondencesDir = path.join(__dirname, '../log/correspondences');
  const files = fs.readdirSync(correspondencesDir);
  
  // Group files by communication pairs
  const grouped = {};
  
  files.forEach(file => {
    const analysis = analyzeFileImproved(file);
    const subject = extractSubjectImproved(file);
    const ext = path.extname(file);
    
    if (!grouped[analysis.pair]) {
      grouped[analysis.pair] = [];
    }
    
    grouped[analysis.pair].push({
      original: file,
      subject: subject,
      extension: ext,
      supervisor: analysis.supervisor,
      worker: analysis.worker
    });
  });
  
  // Generate rename commands
  const renameCommands = [];
  
  Object.keys(grouped).forEach(pair => {
    const files = grouped[pair];
    const total = files.length;
    
    // Sort files logically
    files.sort((a, b) => {
      const order = ['MISSION', 'BRIEF', 'REQ', 'AUTH', 'RESP', 'EVAL', 'VALIDATION', 'COMPLETE', 'CERT'];
      const aOrder = order.findIndex(o => a.subject.includes(o));
      const bOrder = order.findIndex(o => b.subject.includes(o));
      return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
    });
    
    files.forEach((file, index) => {
      const sequence = index + 1;
      const newName = `${file.supervisor}_${file.worker}_${file.subject}_${sequence}of${total}${file.extension}`;
      
      renameCommands.push({
        from: file.original,
        to: newName,
        pair: pair,
        command: `mv "${file.original}" "${newName}"`
      });
    });
  });
  
  return renameCommands;
}

// Execute if run directly
if (require.main === module) {
  executeRenames()
    .then(commands => {
      console.log('Generated rename commands:');
      commands.forEach((cmd, i) => {
        console.log(`${i+1}. ${cmd.from} → ${cmd.to}`);
      });
    })
    .catch(console.error);
}

module.exports = { executeRenames }; 