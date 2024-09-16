const fs = require('fs');

const loadProjectFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                reject('File does not exist:', err);
            } else {
                resolve(filePath);
            }
        });
    });
};

const openExistingProject = (filePath) => {
    return loadProjectFile(filePath);
};

module.exports = { openExistingProject };