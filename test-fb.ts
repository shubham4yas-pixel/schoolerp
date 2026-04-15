import { addTestDocument } from './src/firebase';

async function runTest() {
    console.log("Running Firebase test execution...");
    await addTestDocument();
    console.log("Test execution finished.");
    process.exit(0);
}

runTest();
