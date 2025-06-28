const fs = require('fs');
const path = require('path');

// Define hierarchy - supervisors first, then workers
const HIERARCHY = {
  supervisors: ['EARL', 'DUCHESS', 'PRINCESS'],
  workers: ['PHOENIX', 'SCARLETT', 'CHARLIE', 'AGENT']
};

// Define communication pairs and their subjects
const COMMUNICATIONS = {
  'EARL_PHOENIX': [],
  'DUCHESS_PHOENIX': [],
  'EARL_DUCHESS': [],
  'PRINCESS_PHOENIX': [],
  'SCARLETT_MISSIONS': [],
  'CHARLIE_MISSIONS': [],
  'PHASE_REPORTS': [],
  'VALIDATION_REPORTS': [],
  'DEPLOYMENT_DOCS': []
};

function analyzeFileName(filename) {
  const upper = filename.toUpperCase();
  
  // Determine communication pair
  if (upper.includes('EARL') && upper.includes('PHOENIX')) {
    return upper.startsWith('EARL') ? 
      { pair: 'EARL_PHOENIX', direction: 'supervisor_to_worker' } :
      { pair: 'EARL_PHOENIX', direction: 'worker_to_supervisor' };
  }
  
  if (upper.includes('DUCHESS') && upper.includes('PHOENIX')) {
    return upper.startsWith('DUCHESS') ? 
      { pair: 'DUCHESS_PHOENIX', direction: 'supervisor_to_worker' } :
      { pair: 'DUCHESS_PHOENIX', direction: 'worker_to_supervisor' };
  }
  
  if (upper.includes('EARL') && upper.includes('DUCHESS')) {
    return { pair: 'EARL_DUCHESS', direction: 'peer_to_peer' };
  }
  
  if (upper.includes('PRINCESS') && upper.includes('PHOENIX')) {
    return upper.startsWith('PRINCESS') ? 
      { pair: 'PRINCESS_PHOENIX', direction: 'supervisor_to_worker' } :
      { pair: 'PRINCESS_PHOENIX', direction: 'worker_to_supervisor' };
  }
  
  if (upper.includes('SCARLETT')) {
    return { pair: 'SCARLETT_MISSIONS', direction: 'mission_doc' };
  }
  
  if (upper.includes('CHARLIE')) {
    return { pair: 'CHARLIE_MISSIONS', direction: 'mission_doc' };
  }
  
  if (upper.includes('PHASE_')) {
    return { pair: 'PHASE_REPORTS', direction: 'project_doc' };
  }
  
  if (upper.includes('VALIDATION')) {
    return { pair: 'VALIDATION_REPORTS', direction: 'project_doc' };
  }
  
  if (upper.includes('DEPLOYMENT')) {
    return { pair: 'DEPLOYMENT_DOCS', direction: 'project_doc' };
  }
  
  return { pair: 'MISC', direction: 'unknown' };
}

function extractSubject(filename) {
  const upper = filename.toUpperCase();
  
  // Extract key subject words
  const subjects = [];
  
  if (upper.includes('EVALUATION')) subjects.push('EVAL');
  if (upper.includes('VALIDATION')) subjects.push('VALIDATION');
  if (upper.includes('AUTHORIZATION')) subjects.push('AUTH');
  if (upper.includes('CRITIQUE')) subjects.push('CRITIQUE');
  if (upper.includes('CHECKPOINT')) subjects.push('CHECKPOINT');
  if (upper.includes('ACCELERATION')) subjects.push('ACCEL');
  if (upper.includes('COMPLETION')) subjects.push('COMPLETION');
  if (upper.includes('MISSION')) subjects.push('MISSION');
  if (upper.includes('DEPLOYMENT')) subjects.push('DEPLOY');
  if (upper.includes('INTEGRATION')) subjects.push('INTEGRATION');
  if (upper.includes('STRATEGIC')) subjects.push('STRATEGY');
  if (upper.includes('RESPONSE')) subjects.push('RESPONSE');
  if (upper.includes('REQUEST')) subjects.push('REQUEST');
  if (upper.includes('CERTIFICATE')) subjects.push('CERT');
  if (upper.includes('REPORT')) subjects.push('REPORT');
  if (upper.includes('BRIEF')) subjects.push('BRIEF');
  if (upper.includes('GUIDANCE')) subjects.push('GUIDANCE');
  if (upper.includes('COORDINATION')) subjects.push('COORD');
  if (upper.includes('AUDIT')) subjects.push('AUDIT');
  if (upper.includes('MENTORSHIP')) subjects.push('MENTOR');
  if (upper.includes('TRANSFORMATION')) subjects.push('TRANSFORM');
  if (upper.includes('INTERFACE')) subjects.push('UI');
  
  if (upper.includes('PHASE_4')) subjects.push('P4');
  else if (upper.includes('PHASE_3')) subjects.push('P3');
  else if (upper.includes('PHASE_2')) subjects.push('P2');
  else if (upper.includes('PHASE_1')) subjects.push('P1');
  
  if (upper.includes('6HOUR')) subjects.push('6H');
  if (upper.includes('18HOUR')) subjects.push('18H');
  if (upper.includes('DAY2')) subjects.push('D2');
  
  return subjects.length > 0 ? subjects.join('_') : 'GENERAL';
}

async function organizeCorrespondences() {
  const correspondencesDir = path.join(__dirname, '../log/correspondences');
  const files = fs.readdirSync(correspondencesDir);
  
  // Group files by communication pairs
  const grouped = {};
  
  files.forEach(file => {
    const analysis = analyzeFileName(file);
    const subject = extractSubject(file);
    const ext = path.extname(file);
    
    if (!grouped[analysis.pair]) {
      grouped[analysis.pair] = [];
    }
    
    grouped[analysis.pair].push({
      original: file,
      subject: subject,
      direction: analysis.direction,
      extension: ext
    });
  });
  
  // Generate new names with sequence numbers
  const renamePlan = [];
  
  Object.keys(grouped).forEach(pair => {
    const files = grouped[pair];
    const total = files.length;
    
    // Sort files chronologically if possible (by subject complexity/type)
    files.sort((a, b) => {
      // Mission briefs first, then requests, then responses, then evaluations
      const order = ['MISSION', 'BRIEF', 'REQUEST', 'AUTH', 'RESPONSE', 'EVAL', 'VALIDATION', 'COMPLETION', 'CERT'];
      const aOrder = order.findIndex(o => a.subject.includes(o));
      const bOrder = order.findIndex(o => b.subject.includes(o));
      return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
    });
    
    files.forEach((file, index) => {
      const sequence = index + 1;
      const newName = `${pair}_${file.subject}_${sequence}_OF_${total}${file.extension}`;
      
      renamePlan.push({
        from: file.original,
        to: newName,
        pair: pair,
        sequence: `${sequence}/${total}`
      });
    });
  });
  
  // Output the rename plan
  console.log('='.repeat(80));
  console.log('CORRESPONDENCE ORGANIZATION PLAN');
  console.log('='.repeat(80));
  
  Object.keys(grouped).forEach(pair => {
    console.log(`\n📁 ${pair} (${grouped[pair].length} files):`);
    renamePlan
      .filter(plan => plan.pair === pair)
      .forEach(plan => {
        console.log(`  ${plan.sequence}: ${plan.from}`);
        console.log(`      → ${plan.to}`);
      });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`TOTAL FILES: ${renamePlan.length}`);
  console.log('='.repeat(80));
  
  // Ask for confirmation before executing
  console.log('\nWould you like to execute these renames? (This will be done via separate commands)');
  
  return renamePlan;
}

// Export for use
module.exports = { organizeCorrespondences, analyzeFileName, extractSubject };

// Run if called directly
if (require.main === module) {
  organizeCorrespondences()
    .then(plan => {
      console.log('\nRename plan generated successfully!');
      console.log('Use the returned plan to execute renames.');
    })
    .catch(console.error);
} 