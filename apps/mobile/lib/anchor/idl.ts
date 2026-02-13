// Converted from Anchor 0.31 IDL to 0.28 format for @coral-xyz/anchor v0.28.0
// Source: packages/anchor/target/idl/pledge.json

export const IDL = {
  version: '0.1.0',
  name: 'pledge',
  instructions: [
    {
      name: 'createPledge',
      accounts: [
        { name: 'user', isMut: true, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'pledge', isMut: true, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'userTokenAccount', isMut: true, isSigner: false },
        { name: 'mint', isMut: false, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'associatedTokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'stakeAmount', type: 'u64' },
        { name: 'deadline', type: 'i64' },
        { name: 'createdAt', type: 'i64' },
      ],
    },
    {
      name: 'editPledge',
      accounts: [
        { name: 'user', isMut: false, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'pledge', isMut: true, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'treasuryTokenAccount', isMut: true, isSigner: false },
        { name: 'charityTokenAccount', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
      ],
      args: [{ name: 'newDeadline', type: { option: 'i64' } }],
    },
    {
      name: 'reportCompletion',
      accounts: [
        { name: 'user', isMut: false, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'pledge', isMut: true, isSigner: false },
      ],
      args: [{ name: 'completionPercentage', type: 'u8' }],
    },
    {
      name: 'processCompletion',
      accounts: [
        { name: 'crank', isMut: false, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'pledge', isMut: true, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'user', isMut: true, isSigner: false },
        { name: 'userTokenAccount', isMut: true, isSigner: false },
        { name: 'treasuryTokenAccount', isMut: true, isSigner: false },
        { name: 'charityTokenAccount', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'Pledge',
      type: {
        kind: 'struct',
        fields: [
          { name: 'user', type: 'publicKey' },
          { name: 'mint', type: 'publicKey' },
          { name: 'stakeAmount', type: 'u64' },
          { name: 'deadline', type: 'i64' },
          { name: 'status', type: { defined: 'PledgeStatus' } },
          { name: 'completionPercentage', type: { option: 'u8' } },
          { name: 'reportedAt', type: { option: 'i64' } },
          { name: 'createdAt', type: 'i64' },
          { name: 'bump', type: 'u8' },
          { name: 'vaultBump', type: 'u8' },
        ],
      },
    },
    {
      name: 'ProgramConfig',
      type: {
        kind: 'struct',
        fields: [
          { name: 'admin', type: 'publicKey' },
          { name: 'treasury', type: 'publicKey' },
          { name: 'charity', type: 'publicKey' },
          { name: 'treasurySplitBps', type: 'u16' },
          { name: 'partialFeeBps', type: 'u16' },
          { name: 'editPenaltyBps', type: 'u16' },
          { name: 'gracePeriodSeconds', type: 'i64' },
          { name: 'paused', type: 'bool' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
  types: [
    {
      name: 'PledgeStatus',
      type: {
        kind: 'enum',
        variants: [
          { name: 'Active' },
          { name: 'Reported' },
          { name: 'Completed' },
          { name: 'Forfeited' },
          { name: 'Cancelled' },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: 'Unauthorized', msg: 'Unauthorized - not admin' },
    {
      code: 6001,
      name: 'NotPledgeOwner',
      msg: 'Unauthorized - not pledge owner',
    },
    { code: 6002, name: 'ProgramPaused', msg: 'Program is paused' },
    {
      code: 6006,
      name: 'InvalidDeadline',
      msg: 'Invalid deadline - must be in the future',
    },
    {
      code: 6007,
      name: 'InvalidStakeAmount',
      msg: 'Invalid stake amount - must be greater than 0',
    },
    { code: 6008, name: 'PledgeNotActive', msg: 'Pledge is not active' },
    {
      code: 6010,
      name: 'DeadlineNotPassed',
      msg: 'Deadline has not passed yet',
    },
    {
      code: 6011,
      name: 'DeadlineAlreadyPassed',
      msg: 'Deadline has already passed',
    },
    {
      code: 6013,
      name: 'GracePeriodEnded',
      msg: 'Grace period has ended - cannot report',
    },
    {
      code: 6014,
      name: 'InvalidCompletionPercentage',
      msg: 'Invalid completion percentage - must be 0-100',
    },
  ],
} as const;
