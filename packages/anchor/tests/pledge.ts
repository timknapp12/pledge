/**
 * Pledge Program Integration Tests
 *
 * Run with: anchor test
 *
 * These tests verify all program instructions work correctly:
 * - initialize: Set up program config
 * - create_pledge: User stakes USDC on a goal
 * - edit_pledge: User edits pledge (10% penalty)
 * - report_completion: User reports completion within grace period
 * - process_completion: Crank processes reported pledge
 * - process_expired: Crank processes unreported expired pledge
 * - update_config: Admin updates config parameters
 */

// Import all test suites
// Each file contains describe() blocks that will be executed by mocha

import "./initialize";
import "./createPledge";
import "./reportCompletion";
import "./processCompletion";
import "./processExpired";
import "./editPledge";

// Note: Tests are designed to run sequentially since some tests
// depend on program state from previous tests.
//
// Test execution order:
// 1. initialize - Sets up program config
// 2. createPledge - Creates pledges (uses initialized config)
// 3. reportCompletion - Reports completions (uses created pledges)
// 4. processCompletion - Processes reported pledges
// 5. processExpired - Processes expired pledges
// 6. editPledge - Edits pledges (uses initialized config)
//
// Each test file creates its own test context where needed to avoid
// conflicts between tests.
