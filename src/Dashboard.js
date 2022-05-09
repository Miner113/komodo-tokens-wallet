import React from 'react';
import Blockchain from './blockchain';
import {secondsToString} from './time';
import {sortTransactions} from './sort';
import Jdenticon from './Jdenticon';
import CreateTokenModal from './CreateTokenModal';
import BatchCreateTokenModal from './BatchCreateTokenModal';
import SendTokenModal from './SendTokenModal';
import TransactionDetailsModal from './TransactionDetailsModal';
import Logo from './Logo';
import {chains} from './constants';
import {getMaxSpendNormalUtxos} from './math';
import writeLog from './log';

const SYNC_INTERVAL = 30 * 1000;
let syncTimeoutRef;

class Dashboard extends React.Component {
  state = this.initialState;

  get initialState() {
    this.updateInput = this.updateInput.bind(this);
    this.setActiveToken = this.setActiveToken.bind(this);
    this.logout = this.logout.bind(this);
    this.tokenInfoShowNftData = this.tokenInfoShowNftData.bind(this);

    return {
      tokenList: [],
      tokenBalance: [],
      tokenTransactions: [],
      normalUtxos: [],
      activeToken: null,
      pristine: true,
      tokenInfoShowNftData: false,
    };
  }

  tokenInfoShowNftData() {
    this.setState({
      tokenInfoShowNftData: !this.state.tokenInfoShowNftData,
    });
  }

  getTokenData = (tokenid) => {
    const tokenInfo = this.state.tokenList.filter(tokenInfo => tokenInfo.tokenid === tokenid)[0];
    return tokenInfo;
  }

  logout() {
    clearInterval(syncTimeoutRef);
    syncTimeoutRef = null;
    Blockchain.setExplorerUrl();
    this.setState(this.initialState);
    this.props.resetApp();
  }

  setActiveToken(activeToken) {
    this.setState({
      activeToken: this.state.activeToken === activeToken ? null : activeToken,
    });
  }

  updateInput(e) {
    this.setState({
      [e.target.name]: e.target.value,
    });

    setTimeout(() => {
      writeLog('dashboard this.state', this.state);
    }, 100);
  }

  syncData = async () => {
    let cctxids = [];

    const {address, chain} = this.props;
    const tokenBalance = await Blockchain.tokenBalance(address.cc);
    const tokenTransactions = await Blockchain.tokenTransactions(address.cc);
    const normalUtxos = await Blockchain.getNormalUtxos(address.normal);


    for (var i = 0; i < tokenBalance.balance.length; i++) {
      if (cctxids.indexOf(tokenBalance.balance[i].tokenId) === -1) cctxids.push(tokenBalance.balance[i].tokenId);
    }
    for (var i = 0; i < tokenTransactions.txs.length; i++) {
      if (cctxids.indexOf(tokenTransactions.txs[i].tokenId) === -1) cctxids.push(tokenTransactions.txs[i].tokenId);
    }
    const tokenList = chains[chain].explorerApiVersion && chains[chain].explorerApiVersion === 2 ? await Blockchain.tokenList(cctxids) : await Blockchain.tokenList();

    this.setState({
      tokenList: tokenList.tokens,
      tokenBalance: tokenBalance.balance,
      tokenTransactions: tokenTransactions.txs,
      normalUtxos,
      pristine: false,
    });

    setTimeout(() => {
      writeLog('data synced', this.state);
    }, 100);
  }

  componentWillMount() {
    syncTimeoutRef = setInterval(() => {
      this.syncData();
    }, SYNC_INTERVAL);

    this.syncData();
  }

  componentWillUnmount() {
    clearInterval(syncTimeoutRef);
  }

  getNormalBalance() {
    if (this.state.normalUtxos.length) {
      return {
        value: this.state.normalUtxos.length === 1 ? Number(this.state.normalUtxos[0].amount || 0) : Number(this.state.normalUtxos.reduce((accumulator, item) => Number(accumulator) + Number(item.amount), 0).toFixed(8)),
        satoshi: this.state.normalUtxos.length === 1 ? this.state.normalUtxos[0].satoshi || 0 : this.state.normalUtxos.reduce((accumulator, item) => Number(accumulator) + Number(item.satoshi), 0),
      };
    } else {
      return {
        value: 0,
        satoshi: 0,
      };
    }
  }

  renderTokens() {
    const balances = this.state.tokenBalance;
    let items = [];

    for (let i = 0; i < balances.length; i++) {
      const tokenInfo = this.getTokenData(balances[i].tokenId);

      items.push(
        <div
          key={`token-tile-${balances[i].tokenId}`}
          className={`token-tile${balances[i].tokenId === this.state.activeToken ? ' active' : ''}`}
          onClick={() => this.setActiveToken(balances[i].tokenId)}
          data-testid={`token-tile-${balances[i].tokenId}`}>
          <div className="jdenticon">
            <Jdenticon
              size="48"
              value={tokenInfo.name} />
          </div>
          <strong>{tokenInfo && tokenInfo.name ? tokenInfo.name : balances[i].tokenId}</strong>
          <br />
          <span>{balances[i].balance}</span>
        </div>
      );
    }

    return (
      <React.Fragment>
        <h4>Current holdings</h4>
        {this.state.tokenBalance.length > 0 &&
         this.state.normalUtxos.length > 0 &&
          <SendTokenModal
            tokenList={this.state.tokenList}
            tokenBalance={this.state.tokenBalance}
            normalUtxos={this.state.normalUtxos}
            syncData={this.syncData}
            {...this.props} />
        }
        <div className="token-balance-block">
          {items}
          <CreateTokenModal
            normalUtxos={this.state.normalUtxos}
            syncData={this.syncData}
            {...this.props} />
          {window.location.href.indexOf('enable-batch-create') > -1 &&
            <BatchCreateTokenModal
              {...this.props}
              normalUtxos={this.state.normalUtxos}
              syncData={this.syncData} />
          }
        </div>
      </React.Fragment>
    );
  }

  renderTransactions() {
    const {chain} = this.props;
    let transactions = this.state.tokenTransactions;
    let items = [];

    let transactionsMerge = [];
    for (let i = 0; i < transactions.length; i++) {
      for (let j = 0; j < transactions[i].txs.length; j++) {
        if (!this.state.activeToken ||
            (this.state.activeToken && this.state.activeToken === transactions[i].tokenId)) {
          if (transactions[i].txs[j].height === -1 ||
              transactions[i].txs[j].height === 0) {
            transactions[i].txs[j].height = 0;
            transactions[i].txs[j].time = Math.floor(Date.now() / 1000);
          }

          transactionsMerge.push({
            ...transactions[i].txs[j],
            tokenid: transactions[i].tokenId,
            tokenName: this.getTokenData(transactions[i].tokenId).name,
          });
        }
      }
    }
    transactions = transactionsMerge;

    transactions = sortTransactions(transactions);

    for (let i = 0; i < transactions.length; i++) {
      const tokenInfo = this.getTokenData(transactions[i].tokenid);
      let directionClass = transactions[i].to === this.props.address.cc && transactions[i].to !== transactions[i].from ? 'arrow-alt-circle-down color-green' : 'arrow-alt-circle-up';

      if (transactions[i].to === transactions[i].from) directionClass = 'circle';

      if (transactions[i].type === 'coinbase') directionClass = 'gavel';

      items.push(
        <TransactionDetailsModal
          transaction={transactions[i]}
          directionClass={directionClass}
          tokenInfo={tokenInfo}
          chainInfo={chains[chain]}
          chain={chain}
          key={`token-tile-${transactions[i].txid}-wrapper`}>
          <div
            key={`token-tile-${transactions[i].txid}`}
            className="token-transaction-item"
            data-testid={`token-transaction-${transactions[i].txid}`}>
            <div className="transaction-left">
              <i className={`fa fa-${directionClass}`}></i>
              <div className="jdenticon">
                <Jdenticon
                  size="48"
                  value={tokenInfo.name} />
              </div>
              <div className="token-name">
                {tokenInfo.name}
                {transactions[i].height < 1 &&
                  <i
                    className="fa fa-spinner transaction-unconfirmed"
                    title="Transaction is pending confirmation"></i>
                }
              </div>
              <div className="transaction-time">
                {secondsToString(transactions[i].time)}
              </div>
            </div>
            <div className="transaction-right">
              <div className="transaction-value">{transactions[i].value} {tokenInfo.name}</div>
              <div className="transaction-address">{transactions[i].to}</div>
              <i className="fa fa-chevron-right"></i>
            </div>
          </div>
        </TransactionDetailsModal>
      );
    }

    return (
      <React.Fragment>
        <h4>Last transactions</h4>
        <div className="token-transactions-block">
          {items.length ? items : 'No transactions history'}
        </div>
      </React.Fragment>
    );
  }

  renderTokenInfo() {
    if (this.state.activeToken) {
      const tokenInfo = this.getTokenData(this.state.activeToken);

      console.warn('tokenInfo', tokenInfo);

      const checkTypeOfArbitraryData = (data) => {
        try {
          JSON.parse(data);
          console.warn('JSON.parse(data)', JSON.parse(data));
          return true;
        } catch (e) {
          console.warn(e)
        }
      };

      const renderTokenNFTData = () => {
        if (typeof tokenInfo.data.decoded === 'object') {
          const tokenNFTData = tokenInfo.data.decoded;
          let items = [];

          for (let i = 0; i < Object.keys(tokenNFTData).length; i++) {
            const tokenNFTDataKey = Object.keys(tokenNFTData)[i];
            const tokenNFTDataValue = tokenNFTData[tokenNFTDataKey];

            items.push(
              <tr>
                <td className="ucfirst">
                  <strong>{tokenNFTDataKey}</strong>
                </td>
                <td>
                  {tokenNFTDataKey === 'url' &&
                    <React.Fragment>
                      <a
                        target="_blank"
                        href={tokenNFTDataValue}>
                        {tokenNFTDataValue}
                      </a>
                    </React.Fragment>
                  }
                  {tokenNFTDataKey !== 'url' &&
                    <React.Fragment>{tokenNFTDataKey === 'arbitrary' && checkTypeOfArbitraryData(tokenNFTDataValue) ? <pre className="pre-nostyle">{JSON.stringify(JSON.parse(tokenNFTDataValue), null, 2)}</pre> : tokenNFTDataValue}</React.Fragment>
                  }
                </td>
              </tr>
            );
          }

          return (
            <table className="table">
              <tbody>
                {items}
              </tbody>
            </table>
          );
        } else {
          return tokenInfo.data.decoded;
        }
      };

      return (
        <React.Fragment>
          <h4>
            {tokenInfo.data && tokenInfo.data.decoded &&
              <span
                className="token-info-trigger"
                onClick={this.tokenInfoShowNftData}>
                Token info
                <i className={`fa fa-chevron-${this.state.tokenInfoShowNftData ? 'up' : 'down'}`}></i>
              </span>
            }
            {!tokenInfo.data &&
              <React.Fragment>Token info</React.Fragment>
            }
          </h4>
          <div className="token-info-block">
            <table className="table">
              <tbody>
                <tr>
                  <td>
                    <strong>Name</strong>
                  </td>
                  <td className="token-info-link">
                    <a
                      target="_blank"
                      href={`${chains[this.props.chain].explorerUrl}/${tokenInfo.tokenid}/transactions/${this.props.chain}`}>
                      {tokenInfo.name} <i className="fa fa-external-link-alt"></i>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Description</strong>
                  </td>
                  <td>
                    {tokenInfo.description}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Supply</strong>
                  </td>
                  <td>
                    {tokenInfo.supply}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Owner</strong>
                  </td>
                  <td>
                    {tokenInfo.owner}
                  </td>
                </tr>
                {tokenInfo.data &&
                 tokenInfo.data.decoded &&
                 this.state.tokenInfoShowNftData &&
                  <tr>
                    <td>
                      <strong>Data</strong>
                    </td>
                    <td>
                      {renderTokenNFTData()}
                    </td>
                  </tr>
                }
                {tokenInfo.data &&
                 tokenInfo.data.decoded &&
                 this.state.tokenInfoShowNftData &&
                  <tr>
                    <td>
                      <strong>Raw Data</strong>
                    </td>
                    <td>
                      <pre>{JSON.stringify(tokenInfo.data.decoded, null, 2) }</pre>
                    </td>
                  </tr>
                }
                {tokenInfo.data &&
                 tokenInfo.data.decoded &&
                 !this.state.tokenInfoShowNftData &&
                 <tr>
                  <td colSpan="2">
                    ...
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </React.Fragment>
      );
    }
  }

  render() {
    const maxSpendNormalUtxos = getMaxSpendNormalUtxos(this.state.normalUtxos, 20000);
    const normalBalance = this.getNormalBalance().value;
    const {chain, address} = this.props;
    
    return(
      <div className="main dashboard">
        <i
          className="fa fa-lock logout-btn"
          onClick={this.logout}></i>
        <Logo />
        <div className="content">
          <h4>Wallet | <a onClick={this.props.setActiveView}>Marketplace</a></h4>

          <div className="address-block">
            <div>
              <strong>My Normal address:</strong> {address.normal}
              {chains[chain].faucetURL &&
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`${chains[chain].faucetURL}${address.normal}`}><i className="fa fa-faucet faucet-btn"></i></a>
              }
            </div>
            <div style={{'paddingTop': '20px'}}>
              <strong>My CC address:</strong> {address.cc}
            </div>
            <div style={{'paddingTop': '20px'}}>
              <strong>My pubkey:</strong> {address.pubkey}
            </div>
          </div>

          <div className="tokens-block">
            {this.state.normalUtxos.length > 0  &&
              <React.Fragment>
                <strong>Normal balance:</strong> <span>{normalBalance}</span> <span>{chain}</span>
              </React.Fragment>
            }
            {this.renderTokens()}
            {maxSpendNormalUtxos === 0 &&
             !this.state.pristine &&
              <div>
                <strong>Please make a deposit (min of 0.00002 {chain}) to your normal address in order to create or send tokens</strong>
              </div>
            }
            {this.renderTokenInfo()}
            {this.renderTransactions()}
          </div>
        </div>
      </div>
    );
  }
}

export default Dashboard;