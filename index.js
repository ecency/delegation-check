const dhive = require('@hiveio/dhive')
// setup the dhive client
const client = new dhive.Client(['https://rpc.ecency.com', 'https://api.hive.blog', 'https://api.deathwing.me'])

const delegator = process.env['DELEGATOR'] || 'good-karma'
const pkey = dhive.PrivateKey.fromString(process.env['PKEY'] || '5JSrqca9aLcTbz7SxWty3w1Nbz8LM9264VtjmvuHmYZ1qTr7jgp')
const damount = parseFloat(process.env['DAMOUNT']) || parseFloat('9500.123456 VESTS')
const dday = 1000 * 60 * 60 * 24

async function main() {
  let delegations = [];
  let leng = 1000;
  let from = null;
  do {
    try {
      delegation = await client.database.call("get_vesting_delegations", [delegator, from, 1000])
      leng = delegation.length;
      from = delegation[leng - 1].delegatee;
      delegations = delegations.concat(delegation);
    } catch (error) {
      console.log('error fetching delegations', error)
      main()
    }
  } while (leng == 1000);

  let ops = []
  let accounts = []

  if (delegations) {
    console.log('delegations', delegations.length)
    for (let index = 0; index < delegations.length; index++) {
      const element = delegations[index]
      const currentTime = new Date().getTime()
      const delegationTime = new Date(`${element.min_delegation_time}.000Z`).getTime()

      // check if delegation is more than 7 days old and if it is onboarding delegation
      if (currentTime-delegationTime > 7*dday && (parseFloat(element.vesting_shares) === damount || parseFloat(element.vesting_shares) === 2*damount)) {
        accounts.push(element.delegatee);
      }
    }
    const account = await client.database.call('get_accounts', [
      accounts
    ])
    for (let a = 0; a < account.length; a++) {
      const et = account[a];
      if (et) {
        const lastPostTime = new Date(`${et.last_root_post}.000Z`).getTime()
        // if last post was more than 7 days ago
        // or pending reward + earned reward is higher than delegation
        // remove delegation
        if ((new Date().getTime()-lastPostTime > 7*dday) || ((parseFloat(et.vesting_shares) + parseFloat(et.reward_vesting_balance)) > parseFloat(damount))) {
          const delegate_op = [
            'delegate_vesting_shares',
            {
              delegator: delegator,
              delegatee: et.name,
              vesting_shares: '0.000000 VESTS'
            },
          ];
          ops.push(delegate_op)
        }
      }
    }
    if (ops.length > 0) {
      console.log(ops.length + ' ops');
      let i,j, temporary, chunk = 500;
      for (i = 0,j = ops.length; i < j; i += chunk) {
        temporary = ops.slice(i, i + chunk);
        client.broadcast.sendOperations(temporary, pkey).then(
          function(result) {
            if (result && result.tx) {
              console.log('delegations updated')
            }
          },
          function(error) {
            console.log(`error happened with transaction`, error)
          }
        );
      }
    }
  }
  //console.log(delegations)
}
main().catch(console.error)
