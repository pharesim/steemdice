from piston import Steem
from piston.block import Block
from pistonbase import transactions
from pistonapi.steemnoderpc import SteemNodeRPC
import sqlite3
import json
import sys

#config
watching = 'steemdice1'

wif = ''
node = 'wss://steemd.pevo.science'
client = Steem(node)
rpc = SteemNodeRPC(node)

conn = sqlite3.connect('dice.db')
c = conn.cursor()

checkblocks = 1000

def transfer(sender,recipient,amount,memo):
  expiration = transactions.formatTimeFromNow(60)
  op = transactions.Transfer(
    **{"from": sender,
       "to": recipient,
       "amount": amount,
       "memo": memo}
  )
  ops    = [transactions.Operation(op)]
  ref_block_num, ref_block_prefix = transactions.getBlockParams(rpc)
  tx     = transactions.Signed_Transaction(ref_block_num=ref_block_num,
                                         ref_block_prefix=ref_block_prefix,
                                         expiration=expiration,
                                         operations=ops)
  tx = tx.sign([wif])

  # Broadcast JSON to network
  rpc.broadcast_transaction(tx.json(), api="network_broadcast")

def main():
  c.execute("SELECT blockheight FROM last_check")
  blockheight = c.fetchall()
  startblock = blockheight[0][0]
  offblock = startblock - 30
  minblock = startblock - checkblocks
  tocheck = []
  c.execute("SELECT block, txid, user, amount, bet, asset, won FROM percentagebets WHERE processed IS NOT 0 AND won IS NOT 0 AND block > "+str(minblock)+$
  bets = c.fetchall()
  for bet in bets:
    tocheck.append({
      'block': bet[0],
      'txid': bet[1],
      'user': bet[2],
      'asset': bet[5],
      'amount': bet[3],
      'bet': bet[4],
      'won': bet[6]
    })

  print('Wins to check: '+str(len(tocheck)))
  getblock = startblock
  z = 0
  while getblock > minblock:
    z = z + 1
    if z % 1000 == 0:
      print('Checked '+str(z)+' blocks...')
    try:
      block = Block(getblock,client)
    except:
      block = None

    if block != None:
      for i, txs in enumerate(block['transactions']):
        for (j,tx) in enumerate(txs['operations']):
          if tx[0] == 'transfer' and tx[1]['from'] == watching:
            memo = tx[1]['memo']
            if memo[0:2] == 'Co':
              blockheight = ''.join(c for c in memo[-10:] if c not in ' )')
              touser = tx[1]['to']
              for key,win in enumerate(tocheck):
                if win['user'] == touser and win['block'] == int(blockheight):
                  del tocheck[key]
                  print('Bet at block '+str(blockheight)+' by '+touser+' paid out')
                  print('Possible unpaid wins remaining: '+str(len(tocheck)))

    getblock = getblock - 1

  for i, win in enumerate(tocheck):
    details = json.loads(win['bet'])
    user = win['user']
    won = win['won']
    asset = win['asset']
    block = win['block']
    txid = win['txid']
    try:
      with conn:
        c.execute("UPDATE percentagebets SET processed=0 WHERE block=? AND txid=?",(block,txid))
    except:
      print('ERROR SAVING TO DATABASE!')
#    transfer(watching,user,str(won)+" "+asset,'Congratulations, you won! Your bet: '+details['type']+' '+str(details['number'])+'; Missing payout detect$
    print('Won: '+str(win['won']))
    print('Asset: '+win['asset'])
    print('User: '+win['user'])
    print('Type: '+details['type'])
    print('Number: '+str(details['number']))
    print('Block: '+str(win['block']))
    print('-----------------------------')

main()
