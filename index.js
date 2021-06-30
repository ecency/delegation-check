const dhive = require('@hiveio/dhive')
// setup the dhive client
const client = new dhive.Client(['https://api.hive.blog', 'https://rpc.ecency.com', 'https://api.deathwing.me'])

const delegator = process.env['DELEGATOR'] || 'ecency'
const pkey = dhive.PrivateKey.fromString(process.env['PKEY'] || '5JkC...')
const damount = parseFloat(process.env['DAMOUNT']) || parseFloat('9500.123456 VESTS')
const dday = 1000 * 60 * 60 * 24

async function main() {
  let delegations;
  try {
    delegations = await client.database.call("get_vesting_delegations", [delegator, null, 1000])
  } catch (error) {
    console.log('error fetching delegations', error)
    main()
  }
  let ops = []
  if (delegations) {
    for (let index = 0; index < delegations.length; index++) {
      const element = delegations[index]
      const currentTime = new Date().getTime()
      const delegationTime = new Date(`${element.min_delegation_time}.000Z`).getTime()
      
      // check if delegation is more than 7 days old and if it is onboarding delegation
      if (currentTime-delegationTime > 7*dday && (parseFloat(element.vesting_shares) === damount || parseFloat(element.vesting_shares) === 2*damount)) {
        const [account] = await client.database.call('get_accounts', [
          [element.delegatee]
        ])
  
        if (account) {
          const lastPostTime = new Date(`${account.last_root_post}.000Z`).getTime()
          // if last post was more than 7 days ago
          // or pending reward + earned reward is higher than delegation
          // remove delegation
          if ((currentTime-lastPostTime > 7*dday) || ((parseFloat(account.vesting_shares) + parseFloat(account.reward_vesting_balance)) > parseFloat(damount))) {
            const delegate_op = [
              'delegate_vesting_shares',
              {
                delegator: delegator,
                delegatee: element.delegatee,
                vesting_shares: '0.000000 VESTS'
              },
            ];
            ops.push(delegate_op)
          }
        }
      }
    }
    if (ops.length > 0) {
      console.log(ops)
      client.broadcast.sendOperations(ops, pkey).then(
        function(result) {
          if (result && result.block_num) {
            console.log('delegations updated')
          }
        },
        function(error) {
          console.log(`error happened with transaction`, error)
        }
      );
    }
  }
  //console.log(delegations)
}
main().catch(console.error)
