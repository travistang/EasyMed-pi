const util = require('util');
const exec = util.promisify(require('child_process').exec);
const bleno = require('bleno');
var restart_interface = () =>
{
	console.log('restarting network interface...');
	return exec('sudo ifconfig wlan0 down')
	.catch(e => {})
	.then(() => exec('sudo ifconfig wlan0 up'))
	.catch(e => {});
};

var start_service = (name) =>
{
	console.log('starting ' + name);
	return exec('sudo service ' + name + 'start').catch(e => {});
};

var restart_service = (name) =>
{
	console.log('restarting ' + name);
	return exec('sudo service ' + name + 'restart').catch(e => {});
};
var stop_service = (name) =>
{
	console.log('stopping ' + name);
	return exec('sudo service ' + name + 'stop').catch(e => {});
};
var kill_process = (name) =>
{
	console.log('killing ' + name);
	return exec('sudo pkill ' + name).catch(e => {});
};
var self_assign_address = (addr = '192.168.42.1') =>
{
	console.log('assigning address ' + addr + ' to myself...');
	return exec('sudo ifconfig wlan0 ' + addr).catch(e => {});
};
var flush_address = () =>
{
	console.log('flushing address...');
	return exec('sudo ip addr flush dev wlan0').catch(e => {});
};
var launch_wpa_supplicant = () => 
{
	console.log('launching wpa_supplicant');
	return exec('sudo wpa_supplicant -B -i wlan0 -c /etc/wpa_supplicant/myconf.conf').catch(e => {});
};

var to_emit_mode = () =>
{
	
//		- Disconnect wifi
//		- flush address
//		- self-assign address
//		- launch hostapd process
	return kill_process('wpa_supplicant')
	.then(() => 	kill_process('hostapd'))
	.then(() => 	flush_address())
	.then(() => 	restart_interface())
	.then(() => 	self_assign_address())
	.then(() => 	exec('sudo hostapd -B /etc/hostapd/hostapd.conf'));
};

var to_wifi_mode = () => 
{
	
//		- Kill hostapd process
//		- flush address
//		- restart interface
//		- launch wpa_supplicant
	return kill_process('wpa_supplicant')
	.then(() =>	kill_process('hostapd'))
	.then(() =>	flush_address())
	.then(() =>	restart_interface())
	.then(() =>	launch_wpa_supplicant())
	.then(() =>	restart_service('dhcpcd'))
	.then(() =>	restart_interface());
};

// bluetooth config
var name = 'PiBluetooth';
var serviceUuid = 'fffffffffffffffffffffffffffffff0';
var Characteristic = new bleno.Characteristic({
	uuid: 'fffffffffffffffffffffffffffffff1',
	properties: ['write'],
	onReadRequest: (offset,callback) => callback(this.RESULT_SUCCESS,this._value),
	onWriteRequest: (data,offset,withoutResponse,callback) => 
	{
		var cmd = data.toString('utf8');
		switch(cmd)
		{
			case 'emit':
				console.log('emit!');
				to_emit_mode();
				break;
			case 'wifi':
				console.log('wifi!');
				to_wifi_mode();
				break;
			default:
				console.log('got something:' + cmd);
				break;		
		};
		callback(bleno.Characteristic.RESULT_SUCCESS);
	},
	onSubscribe: (maxValSize,callback) => 
	{
		this._updateValueCallback = callback;
	},
	onUnsubscribe: () =>
	{
		this._updateValueCallback = null;
	},
});

var service = new bleno.PrimaryService({
	uuid: serviceUuid,
	characteristics: [Characteristic]
});
bleno.on('stateChange', (state) => 
{
	if (state == 'poweredOn') {
		console.log('powered on');
		bleno.startAdvertising(name,serviceUuid);
	}
	else{
		console.log('state:' + state);
		bleno.stopAdvertising();
	}
		
});

bleno.on('advertisingStart', (err) =>
{
	console.log('advertising');
	if(!err)
	{
		bleno.setServices([service],(error) => {console.log(JSON.stringify(error))});
	}else
	{
		console.log('error occured while starting to advertise...');
		bleno.stopAdvertising();
	}
});
