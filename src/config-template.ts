const prodConfig = {
    // Paste config here.
    projectId: "replaceme"
};

const stagingConfig = {
    // Paste config here.
    projectId: "replacemetoo"
};

// Maps hostname prefix to config
const rules = [
    { prefix: "localhost", config: stagingConfig },
    { prefix: prodConfig.projectId, config: prodConfig },
    { prefix: stagingConfig.projectId, config: stagingConfig },
    { prefix: "kommer.", config: prodConfig },
];

export function FirebaseConfig() {
    for (const rule of rules) {
        if (location.hostname.startsWith(rule.prefix)) {
            console.log("Host", location.hostname, "matches prefix", rule.prefix);
            return rule.config;
        }
    }
    console.log("Unknown host:", location.hostname);
    return prodConfig;
}
