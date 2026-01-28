// Auto-generated from packages/anchor/target/idl/pledge.json
// Do not edit directly - regenerate with `anchor build`

export const IDL = {
  address: 'PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp',
  metadata: {
    name: 'pledge',
    version: '0.1.0',
    spec: '0.1.0',
    description: 'Pledge - Stake tokens on personal goals',
  },
  instructions: [
    {
      name: 'createPledge',
      docs: ['Create a new pledge and stake tokens'],
      discriminator: [86, 26, 21, 66, 130, 186, 102, 36],
      accounts: [
        { name: 'user', writable: true, signer: true },
        {
          name: 'config',
          pda: {
            seeds: [{ kind: 'const', value: [99, 111, 110, 102, 105, 103] }],
          },
        },
        {
          name: 'pledge',
          writable: true,
          pda: {
            seeds: [
              { kind: 'const', value: [112, 108, 101, 100, 103, 101] },
              { kind: 'account', path: 'user' },
              { kind: 'arg', path: 'createdAt' },
            ],
          },
        },
        {
          name: 'vault',
          writable: true,
          pda: {
            seeds: [
              { kind: 'const', value: [118, 97, 117, 108, 116] },
              { kind: 'account', path: 'pledge' },
            ],
          },
        },
        { name: 'userTokenAccount', writable: true },
        { name: 'mint' },
        {
          name: 'tokenProgram',
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        },
        {
          name: 'associatedTokenProgram',
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
        },
        { name: 'systemProgram', address: '11111111111111111111111111111111' },
      ],
      args: [
        { name: 'stakeAmount', type: 'u64' },
        { name: 'deadline', type: 'i64' },
        { name: 'createdAt', type: 'i64' },
      ],
    },
    {
      name: 'editPledge',
      docs: ['Edit an existing pledge (10% penalty)'],
      discriminator: [110, 82, 248, 164, 37, 82, 33, 87],
      accounts: [
        { name: 'user', signer: true },
        {
          name: 'config',
          pda: {
            seeds: [{ kind: 'const', value: [99, 111, 110, 102, 105, 103] }],
          },
        },
        { name: 'pledge', writable: true },
        { name: 'vault', writable: true },
        { name: 'treasuryTokenAccount', writable: true },
        { name: 'charityTokenAccount', writable: true },
        {
          name: 'tokenProgram',
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        },
      ],
      args: [{ name: 'newDeadline', type: { option: 'i64' } }],
    },
    {
      name: 'reportCompletion',
      docs: ['Report completion percentage (user calls within grace period)'],
      discriminator: [90, 237, 93, 35, 27, 195, 160, 21],
      accounts: [
        { name: 'user', signer: true },
        {
          name: 'config',
          pda: {
            seeds: [{ kind: 'const', value: [99, 111, 110, 102, 105, 103] }],
          },
        },
        { name: 'pledge', writable: true },
      ],
      args: [{ name: 'completionPercentage', type: 'u8' }],
    },
  ],
  accounts: [
    { name: 'pledge', discriminator: [161, 197, 121, 46, 99, 75, 169, 131] },
    {
      name: 'programConfig',
      discriminator: [196, 210, 90, 231, 144, 149, 140, 63],
    },
  ],
  types: [
    {
      name: 'pledge',
      type: {
        kind: 'struct',
        fields: [
          { name: 'user', type: 'pubkey' },
          { name: 'mint', type: 'pubkey' },
          { name: 'stakeAmount', type: 'u64' },
          { name: 'deadline', type: 'i64' },
          { name: 'status', type: { defined: { name: 'pledgeStatus' } } },
          { name: 'completionPercentage', type: { option: 'u8' } },
          { name: 'reportedAt', type: { option: 'i64' } },
          { name: 'createdAt', type: 'i64' },
          { name: 'bump', type: 'u8' },
          { name: 'vaultBump', type: 'u8' },
        ],
      },
    },
    {
      name: 'pledgeStatus',
      type: {
        kind: 'enum',
        variants: [
          { name: 'active' },
          { name: 'reported' },
          { name: 'completed' },
          { name: 'forfeited' },
          { name: 'cancelled' },
        ],
      },
    },
    {
      name: 'programConfig',
      type: {
        kind: 'struct',
        fields: [
          { name: 'admin', type: 'pubkey' },
          { name: 'treasury', type: 'pubkey' },
          { name: 'charity', type: 'pubkey' },
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
  errors: [
    { code: 6000, name: 'unauthorized', msg: 'Unauthorized - not admin' },
    {
      code: 6001,
      name: 'notPledgeOwner',
      msg: 'Unauthorized - not pledge owner',
    },
    { code: 6002, name: 'programPaused', msg: 'Program is paused' },
    {
      code: 6006,
      name: 'invalidDeadline',
      msg: 'Invalid deadline - must be in the future',
    },
    {
      code: 6007,
      name: 'invalidStakeAmount',
      msg: 'Invalid stake amount - must be greater than 0',
    },
    { code: 6008, name: 'pledgeNotActive', msg: 'Pledge is not active' },
    {
      code: 6010,
      name: 'deadlineNotPassed',
      msg: 'Deadline has not passed yet',
    },
    {
      code: 6011,
      name: 'deadlineAlreadyPassed',
      msg: 'Deadline has already passed',
    },
    {
      code: 6013,
      name: 'gracePeriodEnded',
      msg: 'Grace period has ended - cannot report',
    },
    {
      code: 6014,
      name: 'invalidCompletionPercentage',
      msg: 'Invalid completion percentage - must be 0-100',
    },
  ],
} as const;
