'use strict';

const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const clr = require('chalk');
const inquirer = require('inquirer');
const promisify = require('es6-promisify');
//const _ = require('lodash');
const log = console.log;
const defaultConnectionStr = 'mongodb://localhost:27017/';


class DataBase {

    constructor(connectionStr) {
        this.connectionStr = connectionStr;
    }

    async connect() {
        this.connection = await promisify(MongoClient.connect)(this.connectionStr);
        return this.connection;
    }

    disconnect() {
        if (this.connection) this.connection.close();
    }

    static createConnectionStr(value) {
        return value.startsWith('mongodb://') ? value : defaultConnectionStr + value;
    }
}

// async function connectToMongo(connectionStr, fnCallback){
//     try {
//         let db = await promisify(MongoClient.connect)(connectionStr);

//         let callbackResult;
//         if (fnCallback != null) callbackResult = fnCallback(db);

//         db.close();

//         return callbackResult;
//     } catch (err) {
//         throw `There was an error while trying to connect to the database (${err.message})`;
//     }


//     /*let promise = promisify(MongoClient.connect);
//     promise(connectionStr).then(db => {
//         log(db);
//     }).catch(err => {
//         log(err);
//     });*/

//     /*MongoClient.connect(connectionStr, (err, db) => {
//         if (err) return `There was an error while trying to connect to the database (${err.message})`;
//         if (fnCallback != null) fnCallback(db);
//         db.close();
//     });*/
// }

const questions = [
    {
        type: 'input',
        name: 'filepath',
        message: 'Path of the file containing json data to parse:',
        default: 'data.json',
        validate: value => {
            return fs.existsSync(value) ? true : 'File does not exist, please try again...';
        }
    },
    {
        type: 'input',
        name: 'connectionString',
        message: `Insert the database name for the default connection or the complete connection string:`,
        default: defaultConnectionStr,
        validate: async (value) => {
            let connectionStr = DataBase.createConnectionStr(value);
            
            let db = new DataBase(connectionStr);
            try {
                await db.connect();
                db.disconnect();
                return true;
            }
            catch (err) {
                return err.message;
            }
        },
        filter: value => {
            return DataBase.createConnectionStr(value);
        }
    },
    {
        type: 'input',
        name: 'collectionName',
        message: 'What\'s the name of the collection?',
        validate: async (...args) => {
            let value = args[0];
            let connectionStr = args[1]['connectionString'];
            let db = new DataBase(connectionStr);
            try {
                await db.connect();

                // Async validation
                return new Promise((resolve, reject) => {
                    db.connection.collections((err, collections) => {
                        let collection = collections.find(x => x.collectionName === value);
                        let index = collections.indexOf(collection);
                        db.disconnect();
                        if (index > -1) resolve(true);
                        else reject('Collection does not exist. Please try again');
                    });
                });
            }
            catch (err) {
                return err.message;
            }
        }
    }
];


async function readFile(filePath) {
    return await fs.readFileSync(filePath, 'utf8');
}

(async () => {

    let answers = await inquirer.prompt(questions);
    log(clr.yellow(JSON.stringify(answers)));


    let db = new DataBase(answers.connectionString);

    try {
        let data = JSON.parse(await readFile(answers.filepath));

        await db.connect();
        let collection = db.connection.collection(answers.collectionName);
        collection.insert(data, {w:1}, (err, result) => {
            log(err ? clr.red(err.message) : clr.green('Documents inserted successfully'));
            db.disconnect();
        });
    }
    catch (err) {
        log(clr.red(err.message));
        db.disconnect();
    }
})();
