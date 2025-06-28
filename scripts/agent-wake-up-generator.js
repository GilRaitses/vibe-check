#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

class AgentWakeUpGenerator {
    constructor() {
        this.agentsDir = path.join(__dirname, '..', 'agents');
        this.docsDir = path.join(__dirname, '..', 'docs');
        this.templateFile = path.join(this.docsDir, 'AGENT_WAKE_UP_PROMPT_TEMPLATE.md');
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async run() {
        try {
            console.log(`${colors.cyan}${colors.bright}🤖 NYC Vibe Check Agent Wake-Up Generator${colors.reset}`);
            console.log(`${colors.yellow}================================================${colors.reset}\n`);
            
            const agents = await this.getAvailableAgents();
            if (agents.length === 0) {
                console.log(`${colors.red}❌ No agent configuration files found in ${this.agentsDir}${colors.reset}`);
                this.close();
                return;
            }

            const selectedAgent = await this.presentAgentMenu(agents);
            const agentConfig = await this.loadAgentConfig(selectedAgent);
            const template = await this.loadTemplate();
            
            const personalizedPrompt = this.generatePersonalizedPrompt(agentConfig, template, selectedAgent);
            const outputPath = await this.savePrompt(selectedAgent, personalizedPrompt);
            
            console.log(`\n${colors.green}${colors.bright}✅ Success!${colors.reset}`);
            console.log(`${colors.green}Agent wake-up prompt generated: ${colors.cyan}${outputPath}${colors.reset}\n`);
            
            this.showUsageInstructions(selectedAgent);
            
        } catch (error) {
            console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
        } finally {
            this.close();
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

    async presentAgentMenu(agents) {
        console.log(`${colors.bright}Available Agents:${colors.reset}`);
        agents.forEach((agent, index) => {
            console.log(`${colors.yellow}${index + 1}.${colors.reset} ${colors.bright}${agent.name}${colors.reset} (${agent.filename})`);
        });
        
        console.log(`${colors.yellow}0.${colors.reset} ${colors.red}Exit${colors.reset}\n`);
        
        return new Promise((resolve) => {
            this.rl.question(`${colors.cyan}Select an agent to wake up (1-${agents.length}): ${colors.reset}`, (answer) => {
                const choice = parseInt(answer);
                
                if (choice === 0) {
                    console.log(`${colors.yellow}👋 Goodbye!${colors.reset}`);
                    process.exit(0);
                }
                
                if (choice >= 1 && choice <= agents.length) {
                    resolve(agents[choice - 1]);
                } else {
                    console.log(`${colors.red}❌ Invalid selection. Please try again.${colors.reset}\n`);
                    resolve(this.presentAgentMenu(agents));
                }
            });
        });
    }

    async loadAgentConfig(agent) {
        try {
            const configContent = fs.readFileSync(agent.path, 'utf8');
            const config = yaml.load(configContent);
            console.log(`${colors.green}✓ Loaded config for ${colors.bright}${agent.name}${colors.reset}`);
            return { ...config, agentName: agent.name, filename: agent.filename };
        } catch (error) {
            throw new Error(`Failed to load agent config: ${error.message}`);
        }
    }

    async loadTemplate() {
        try {
            const template = fs.readFileSync(this.templateFile, 'utf8');
            console.log(`${colors.green}✓ Loaded wake-up template${colors.reset}`);
            return template;
        } catch (error) {
            throw new Error(`Failed to load template: ${error.message}`);
        }
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
        const outputPath = path.join(this.agentsDir, outputFilename);
        
        fs.writeFileSync(outputPath, prompt, 'utf8');
        return outputPath;
    }

    showUsageInstructions(agent) {
        console.log(`${colors.bright}Usage Instructions:${colors.reset}`);
        console.log(`${colors.yellow}1.${colors.reset} Copy the generated prompt file: ${colors.cyan}agents/${agent.name}_WAKE_UP_PROMPT.md${colors.reset}`);
        console.log(`${colors.yellow}2.${colors.reset} Give it to any AI agent with the simple command:`);
        console.log(`   ${colors.green}${colors.bright}"Hello ${agent.name}"${colors.reset}`);
        console.log(`${colors.yellow}3.${colors.reset} The agent will automatically begin the wake-up sequence`);
        console.log(`${colors.yellow}4.${colors.reset} Wait for their authentication and status report\n`);
        
        console.log(`${colors.bright}What the agent will do:${colors.reset}`);
        console.log(`${colors.blue}•${colors.reset} Load and validate their character configuration`);
        console.log(`${colors.blue}•${colors.reset} Review their correspondence files chronologically`);
        console.log(`${colors.blue}•${colors.reset} Authenticate their technical capabilities`);
        console.log(`${colors.blue}•${colors.reset} Report their current mission status`);
        console.log(`${colors.blue}•${colors.reset} Request specific next actions`);
        console.log(`${colors.blue}•${colors.reset} Maintain authentic character voice and relationships\n`);
    }

    close() {
        this.rl.close();
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
    const generator = new AgentWakeUpGenerator();
    generator.run();
}

module.exports = AgentWakeUpGenerator; 