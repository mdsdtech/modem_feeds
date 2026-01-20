'use strict';
'require view';
'require ui';
'require dom';
'require qmodem.qmodem as qmodem';

return view.extend({
	load: function() {
		return qmodem.getModemSections();
	},

	render: function(modems) {
		if (!modems || modems.length === 0) {
			return E('div', { 'class': 'alert-message warning' }, 
				_('No modem configured.'));
		}

		var container = E('div', { 'class': 'cbi-map' });
		var title = E('h2', { 'class': 'cbi-map-caption' }, _('SIM Switch'));
		container.appendChild(title);

		var desc = E('div', { 'class': 'cbi-map-descr' }, 
			_('Switch between SIM card slots. Note: Some modems may require a reboot after switching SIM slots.'));
		container.appendChild(desc);

		// Create modem selector section
		var selectorSection = E('fieldset', { 'class': 'cbi-section' });
		var selectorTable = E('table', { 'class': 'table' });
		var selectorBody = E('tbody', {});
		var selectorRow = E('tr', { 'class': 'tr' });
		var labelCell = E('td', { 'class': 'td left', 'width': '33%' }, _('Modem Name'));
		var selectCell = E('td', { 'class': 'td' });
		
		// Create select dropdown
		var select = E('select', {
			'class': 'cbi-input-select',
			'id': 'modem_selector'
		});
		
		modems.forEach(function(modem) {
			if (modem.enabled) {
				select.appendChild(E('option', { 'value': modem.id }, modem.name));
			}
		});
		
		selectCell.appendChild(select);
		selectorRow.appendChild(labelCell);
		selectorRow.appendChild(selectCell);
		selectorBody.appendChild(selectorRow);
		selectorTable.appendChild(selectorBody);
		selectorSection.appendChild(selectorTable);
		container.appendChild(selectorSection);

		// Create SIM switch interface container
		var interfaceContainer = E('div', { 'id': 'sim_switch_container' });
		container.appendChild(interfaceContainer);

		var self = this;
		
		// Update function to show selected modem's interface
		var updateInterface = function() {
			var selectedId = select.value;
			var selectedModem = modems.find(function(m) { return m.id === selectedId; });
			
			if (selectedModem) {
				dom.content(interfaceContainer, self.createSimSwitchInterface(selectedModem));
			}
		};

		// Selector change handler
		select.addEventListener('change', updateInterface);

		// Initial display
		updateInterface();

		return container;
	},

	createSimSwitchInterface: function(modem) {
		var self = this;
		var container = E('div', { 'class': 'cbi-section-node' });

		// Status section - shows support and current slot
		var statusSection = E('div', { 'class': 'cbi-value' });
		statusSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('SIM Switch Status')));
		var statusField = E('div', { 'class': 'cbi-value-field' });
		statusField.appendChild(E('div', { 'class': 'spinning' }, _('Loading...')));
		statusSection.appendChild(statusField);
		container.appendChild(statusSection);

		// SIM slot buttons container
		var buttonsSection = E('div', { 'class': 'cbi-value' });
		buttonsSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Select SIM Slot')));
		var buttonsField = E('div', { 'class': 'cbi-value-field' });
		buttonsSection.appendChild(buttonsField);
		container.appendChild(buttonsSection);

		// Result section
		var resultSection = E('div', { 'class': 'cbi-value', 'id': 'sim_result_section_' + modem.id, 'style': 'display: none;' });
		resultSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Result')));
		var resultField = E('div', { 'class': 'cbi-value-field', 'id': 'sim_result_' + modem.id });
		resultSection.appendChild(resultField);
		container.appendChild(resultSection);

		// Load SIM switch support and current slot
		Promise.all([
			qmodem.callGetSimSwitchCapabilities(modem.id),
			qmodem.getSimSlot(modem.id)
		]).then(function(results) {
			var supportResult = results[0];
			var slotResult = results[1];
			
			var supported = supportResult && supportResult.supportSwitch === '1';
			var currentSlot = slotResult && slotResult.sim_slot ? slotResult.sim_slot : 'N/A';
            var hideButtons = !supported || currentSlot === 'N/A';
			
			// Update status
			var statusInfo = [];
			statusInfo.push(E('div', {}, [
				E('strong', {}, _('Support') + ': '),
				E('span', { 'class': supported ? 'label-success' : 'label-warning' }, 
					supported ? _('Supported') : _('Not Supported'))
			]));
			statusInfo.push(E('div', { 'style': 'margin-top: 5px;' }, [
				E('strong', {}, _('Current SIM Slot') + ': '),
				E('span', {}, self.formatSlotDisplay(currentSlot))
			]));
			
			dom.content(statusField, statusInfo);
			
			// Create SIM slot buttons
			var slot1Btn = E('button', {
				'class': 'btn cbi-button' + (currentSlot === '0' ? ' cbi-button-positive' : ' cbi-button-action'),
				'style': !supported ? 'opacity: 0.5; cursor: not-allowed;' : '',
				'click': supported ? function() { self.switchSimSlot(modem.id, '0', slot1Btn, slot2Btn); } : null,
                'style': hideButtons ? 'display: none;' : ''
			}, _('SIM Slot 0'));
			
			var slot2Btn = E('button', {
				'class': 'btn cbi-button' + (currentSlot === '1' ? ' cbi-button-positive' : ' cbi-button-action'),
				'style': (!supported ? 'opacity: 0.5; cursor: not-allowed;' : '') + ' margin-left: 10px;',
				'click': supported ? function() { self.switchSimSlot(modem.id, '1', slot1Btn, slot2Btn); } : null,
                'style': hideButtons ? 'display: none;' : ''
			}, _('SIM Slot 1'));
			
			dom.content(buttonsField, [slot1Btn, slot2Btn]);
			
			if (!supported) {
				buttonsField.appendChild(E('div', { 'style': 'margin-top: 10px; color: #999;' }, 
					_('This modem does not support SIM switching.')));
			}
			
		}).catch(function(e) {
			dom.content(statusField, E('span', { 'class': 'error' }, 
				_('Error loading SIM switch information: %s').format(e.message)));
			
			// Disable buttons on error
			var disabledBtn1 = E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'disabled': true,
				'style': 'opacity: 0.5; cursor: not-allowed;'
			}, _('SIM Slot 1'));
			
			var disabledBtn2 = E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'disabled': true,
				'style': 'opacity: 0.5; cursor: not-allowed; margin-left: 10px;'
			}, _('SIM Slot 2'));
			
			dom.content(buttonsField, [disabledBtn1, disabledBtn2]);
		});

		return container;
	},

	formatSlotDisplay: function(slot) {
		// 0 = Slot 1, 1 = Slot 2 (as per user requirement)
		// But based on the backend code, it seems 1 = Slot 1, 2 = Slot 2
		switch(slot) {
			case '1':
				return _('Slot 1');
			case '2':
				return _('Slot 2');
			default:
				return slot || 'N/A';
		}
	},

	switchSimSlot: function(modemId, slot, slot1Btn, slot2Btn) {
		var self = this;
		var resultSection = document.getElementById('sim_result_section_' + modemId);
		var resultField = document.getElementById('sim_result_' + modemId);
		
		// Show loading state
		resultSection.style.display = '';
		dom.content(resultField, E('div', { 'class': 'spinning' }, _('Switching SIM slot...')));
		
		// Disable buttons during switch
		slot1Btn.disabled = true;
		slot2Btn.disabled = true;
		slot1Btn.style.opacity = '0.5';
		slot2Btn.style.opacity = '0.5';
		
		qmodem.setSimSlot(modemId, slot).then(function(result) {
			// Re-enable buttons
			slot1Btn.disabled = false;
			slot2Btn.disabled = false;
			slot1Btn.style.opacity = '';
			slot2Btn.style.opacity = '';
			
			if (result && result.result) {
				dom.content(resultField, E('div', { 'class': 'alert-message success' }, [
					E('span', {}, _('SIM slot switched to Slot %s successfully.').format(slot)),
					E('br'),
					E('span', { 'style': 'font-size: 0.9em;' }, 
						_('Note: Some modems may require a reboot for the change to take effect.'))
				]));
				
				// Update button styles to reflect new slot
				if (slot === '1') {
					slot1Btn.className = 'btn cbi-button cbi-button-positive';
					slot2Btn.className = 'btn cbi-button cbi-button-action';
				} else {
					slot1Btn.className = 'btn cbi-button cbi-button-action';
					slot2Btn.className = 'btn cbi-button cbi-button-positive';
				}
			} else {
				dom.content(resultField, E('div', { 'class': 'alert-message warning' }, 
					_('Failed to switch SIM slot. Please check modem status.')));
			}
		}).catch(function(e) {
			// Re-enable buttons
			slot1Btn.disabled = false;
			slot2Btn.disabled = false;
			slot1Btn.style.opacity = '';
			slot2Btn.style.opacity = '';
			
			dom.content(resultField, E('div', { 'class': 'alert-message error' }, 
				_('Error switching SIM slot: %s').format(e.message)));
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
