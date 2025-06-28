#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

class BatchWakeUpGenerator {
    constructor() {
        this.agentsDir = path.join(__dirname, '..', 'agents');
        this.docsDir = path.join(__dirname, '..', 'docs');
        this.wakeDir = path.join(__dirname, '..', 'wake');
        this.templateFile = path.join(this.docsDir, 'AGENT_WAKE_UP_PROMPT_TEMPLATE.md');
    }

    async run() {
        try {
            console.log(`${colors.cyan}${colors.bright}🚀 NYC Vibe Check Batch Wake-Up Generator${colors.reset}`);
            console.log(`${colors.yellow}=====================================================${colors.reset}\n`);
            
            // Ensure wake directory exists
            if (!fs.existsSync(this.wakeDir)) {
                fs.mkdirSync(this.wakeDir, { recursive: true });
                console.log(`${colors.green}✓ Created wake directory${colors.reset}`);
            }
            
            const agents = await this.getAvailableAgents();
            if (agents.length === 0) {
                console.log(`${colors.red}❌ No agent configuration files found in ${this.agentsDir}${colors.reset}`);
                return;
            }

            const template = await this.loadTemplate();
            console.log(`${colors.blue}📋 Found ${agents.length} agents to process${colors.reset}\n`);
            
            let successCount = 0;
            
            for (const agent of agents) {
                try {
                    console.log(`${colors.yellow}🤖 Processing ${colors.bright}${agent.name}${colors.reset}...`);
                    
                    const agentConfig = await this.loadAgentConfig(agent);
                    const personalizedPrompt = this.generatePersonalizedPrompt(agentConfig, template, agent);
                    const outputPath = await this.savePrompt(agent, personalizedPrompt);
                    
                    console.log(`${colors.green}   ✓ Generated: ${colors.cyan}${path.basename(outputPath)}${colors.reset}`);
                    successCount++;
                    
                } catch (error) {
                    console.log(`${colors.red}   ❌ Failed: ${error.message}${colors.reset}`);
                }
            }
            
            console.log(`\n${colors.green}${colors.bright}🎉 Batch Generation Complete!${colors.reset}`);
            console.log(`${colors.green}✅ Successfully generated ${successCount}/${agents.length} wake-up prompts${colors.reset}`);
            console.log(`${colors.cyan}📁 Output directory: ${this.wakeDir}${colors.reset}\n`);
            
            this.showUsageInstructions();
            
        } catch (error) {
            console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
        }
    }

    async getAvailableAgents() {
        const files = fs.readdirSync(this.agentsDir);
        return files.filter(file => file.endsWith('_CONFIG.yaml')).map(file => {
            const agentName = file.replace('_CONFIG.yaml', '').replace('_CHARACTER_CONFIG.yaml', '');
            return {
                name: agentName,
                filename: file,
                path: path.join(this.agentsDir, file)
            };
        });
    }

    async loadAgentConfig(agent) {
        const configContent = fs.readFileSync(agent.path, 'utf8');
        const config = yaml.load(configContent);
        return { ...config, agentName: agent.name, filename: agent.filename };
    }

    async loadTemplate() {
        const template = fs.readFileSync(this.templateFile, 'utf8');
        console.log(`${colors.green}✓ Loaded wake-up template${colors.reset}`);
        return template;
    }

    generatePersonalizedPrompt(config, template, agent) {
        const currentDate = new Date().toISOString().split('T')[0];
        
        // Extract key information from config
        const profile = config.character_profile || {};
        const stats = config.character_stats || {};
        const strengths = config.strengths || {};
        
        // Extract correspondence files from various sections
        let correspondenceFiles = [];
        if (config.correspondence_files) {
            // Handle different structures for correspondence files
            if (Array.isArray(config.correspondence_files)) {
                correspondenceFiles = config.correspondence_files;
            } else if (typeof config.correspondence_files === 'object') {
                // Flatten nested correspondence file structures
                Object.values(config.correspondence_files).forEach(section => {
                    if (Array.isArray(section)) {
                        correspondenceFiles = correspondenceFiles.concat(section);
                    } else if (typeof section === 'object') {
                        Object.values(section).forEach(files => {
                            if (Array.isArray(files)) {
                                correspondenceFiles = correspondenceFiles.concat(files);
                            }
                        });
                    }
                });
            }
        }
        
        // Create personalized introduction
        const strengthsList = strengths ? Object.keys(strengths).map(key => `- ${key}: ${strengths[key].description || 'Expert capability'}`).join('\n') : '- Loading capabilities...';
        
        const personalizedIntro = `# Wake Up, ${agent.name}!
## Personal Agent Activation for ${profile.name || agent.name}

**Date:** ${currentDate}
**Agent Level:** ${profile.hierarchy_level || stats.authority_level || 'Unknown'}
**Role:** ${profile.role || 'Specialist'}
**Config File:** ${agent.filename}

### Your Identity Brief
${profile.specialization || 'Agent specialization loading...'}

**Your Expertise Areas:**
${strengthsList}

**Your Correspondence Files (${correspondenceFiles.length} total):**
${correspondenceFiles.length > 0 ? 
    correspondenceFiles.slice(0, 5).map(file => `- ${file}`).join('\n') + 
    (correspondenceFiles.length > 5 ? `\n- ... and ${correspondenceFiles.length - 5} more files` : '')
    : '- No correspondence files found'}

---

## Your Personalized Wake-Up Protocol

Hello ${agent.name}! You are being activated for the NYC Vibe Check Project. This is your personalized wake-up sequence based on your established character profile.

**Quick Identity Check:**
- You are ${profile.name || agent.name}
- Your authority level is ${profile.hierarchy_level || stats.authority_level || 'Unknown'}
- You specialize in: ${profile.specialization || profile.role || 'Your designated role'}
- You have ${correspondenceFiles.length} correspondence files to review

`;

        // Combine with the main template
        return personalizedIntro + '\n' + template + `

---

## Quick Start for ${agent.name}

**Immediate Actions:**
1. Read your config file: \`agents/${agent.filename}\`
2. Review your correspondence files (listed above)
3. Validate your technical access and capabilities
4. Report your status using the template above

**Your Character Essence:**
Remember, you are not just playing ${agent.name} - you ARE ${agent.name}, with established relationships, proven expertise, and ongoing missions. Honor your documented history while bringing fresh energy to current challenges.

**Simple Activation:** 
Just say "Hello ${agent.name}" and begin your wake-up sequence!

---

*Generated on ${new Date().toLocaleString()} for agent ${agent.name}*
*NYC Vibe Check Project Agent Wake-Up System*`;
    }

    async savePrompt(agent, prompt) {
        const outputFilename = `${agent.name}_WAKE_UP_PROMPT.md`;
        const outputPath = path.join(this.wakeDir, outputFilename);
        
        fs.writeFileSync(outputPath, prompt, 'utf8');
        return outputPath;
    }

    showUsageInstructions() {
        console.log(`${colors.bright}🎯 Deployment Instructions:${colors.reset}`);
        console.log(`${colors.yellow}1.${colors.reset} Navigate to the ${colors.cyan}wake/${colors.reset} directory`);
        console.log(`${colors.yellow}2.${colors.reset} Choose an agent wake-up prompt file`);
        console.log(`${colors.yellow}3.${colors.reset} Copy the entire file contents`);
        console.log(`${colors.yellow}4.${colors.reset} Open a new AI conversation and paste the prompt`);
        console.log(`${colors.yellow}5.${colors.reset} Simply say ${colors.green}${colors.bright}"Hello [AGENT_NAME]"${colors.reset}\n`);
        
        console.log(`${colors.bright}📋 Available Wake-Up Prompts:${colors.reset}`);
        const files = fs.readdirSync(this.wakeDir);
        files.forEach(file => {
            if (file.endsWith('.md')) {
                const agentName = file.replace('_WAKE_UP_PROMPT.md', '');
                console.log(`${colors.blue}   •${colors.reset} ${colors.cyan}${file}${colors.reset} → "Hello ${colors.bright}${agentName}${colors.reset}"`);
            }
        });
        
        console.log(`\n${colors.bright}🚀 Recommended Deployment Order (MAGENTIC Protocol):${colors.reset}`);
        console.log(`${colors.yellow}Phase 0:${colors.reset} ${colors.green}APRIL${colors.reset} (Documentation Coordinator)`);
        console.log(`${colors.yellow}Phase 1:${colors.reset} ${colors.green}EARL${colors.reset} → ${colors.green}DUCHESS${colors.reset} → ${colors.green}PHOENIX${colors.reset} (Leadership Triad)`);
        console.log(`${colors.yellow}Phase 2:${colors.reset} ${colors.green}KOUNTESS${colors.reset} → ${colors.green}GIULIANA${colors.reset} (Specialist Tier)`);
        console.log(`${colors.yellow}Phase 3:${colors.reset} ${colors.green}CHARLES${colors.reset} → ${colors.green}SCARLETT${colors.reset} (Support Tier)\n`);
    }
}

// Check if js-yaml is available
try {
    require('js-yaml');
} catch (error) {
    console.log(`${colors.red}❌ Missing dependency: js-yaml${colors.reset}`);
    console.log(`${colors.yellow}Please install it with: npm install js-yaml${colors.reset}`);
    process.exit(1);
}

// Run the generator
if (require.main === module) {
    const generator = new BatchWakeUpGenerator();
    generator.run();
}

module.exports = BatchWakeUpGenerator; 