import { App, Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext } from 'obsidian';

interface LineBreakSettings {
	triggerWord: string;
	breakMethod: 'zero-width' | 'html-br' | 'css-break';
	enabled: boolean;
}

const DEFAULT_SETTINGS: LineBreakSettings = {
	triggerWord: '.break.',
	breakMethod: 'zero-width',
	enabled: true
};

export default class InvisibleLineBreakPlugin extends Plugin {
	settings: LineBreakSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new LineBreakSettingTab(this.app, this));

		this.registerMarkdownPostProcessor((element, context) => {
			if (!this.settings.enabled) return;
			this.processLineBreaks(element, context);
		});

		this.registerMarkdownPostProcessor((element, context) => {
			if (!this.settings.enabled) return;
			this.processLivePreview(element, context);
		});

		console.log('Invisible Line Break Plugin loaded');
	}

	onunload() {
		console.log('Invisible Line Break Plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	processLineBreaks(element: HTMLElement, context: MarkdownPostProcessorContext) {
		const walker = document.createTreeWalker(
			element,
			NodeFilter.SHOW_TEXT,
			null
		);

		const textNodes: Text[] = [];
		let node;
		while (node = walker.nextNode()) {
			if (node.textContent?.includes(this.settings.triggerWord)) {
				textNodes.push(node as Text);
			}
		}

		textNodes.forEach(textNode => {
			const text = textNode.textContent || '';
			if (text.includes(this.settings.triggerWord)) {
				this.replaceTextNodeWithBreaks(textNode, text);
			}
		});
	}

	processLivePreview(element: HTMLElement, context: MarkdownPostProcessorContext) {
		this.processLineBreaks(element, context);
	}

	replaceTextNodeWithBreaks(textNode: Text, text: string) {
		const parts = text.split(this.settings.triggerWord);

		if (parts.length <= 1) return;

		const parent = textNode.parentNode;
		if (!parent) return;
		const fragment = document.createDocumentFragment();

		parts.forEach((part, index) => {
			if (part.length > 0) {
				fragment.appendChild(document.createTextNode(part));
			}

			if (index < parts.length - 1) {
				fragment.appendChild(this.createLineBreak());
			}
		});

		// Replace original text node with fragment
		parent.replaceChild(fragment, textNode);
	}

	createLineBreak(): HTMLElement | Text {
		switch (this.settings.breakMethod) {
			case 'zero-width':
				const zeroWidthSpan = document.createElement('span');
				zeroWidthSpan.style.display = 'block';
				zeroWidthSpan.style.height = '1em';
				zeroWidthSpan.style.lineHeight = '1em';
				zeroWidthSpan.innerHTML = '&#8203;';
				return zeroWidthSpan;

			case 'html-br':
				return document.createElement('br');

			case 'css-break':
				const cssSpan = document.createElement('span');
				cssSpan.style.display = 'block';
				cssSpan.style.content = '""';
				cssSpan.style.marginTop = '1em';
				return cssSpan;

			default:
				return document.createElement('br');
		}
	}
}

class LineBreakSettingTab extends PluginSettingTab {
	plugin: InvisibleLineBreakPlugin;

	constructor(app: App, plugin: InvisibleLineBreakPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Trigger word')
			.setDesc('Word to replace with line break')
			.addText(text => text
				.setPlaceholder('.break.')
				.setValue(this.plugin.settings.triggerWord)
				.onChange(async (value) => {
					this.plugin.settings.triggerWord = value || '.break.';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Break method')
			.addDropdown(dropdown => dropdown
				.addOption('zero-width', 'Zero-width (recommended)')
				.addOption('html-br', 'HTML <br>')
				.addOption('css-break', 'CSS block')
				.setValue(this.plugin.settings.breakMethod)
				.onChange(async (value: 'zero-width' | 'html-br' | 'css-break') => {
					this.plugin.settings.breakMethod = value;
					await this.plugin.saveSettings();
				}));

		const usage = containerEl.createDiv();
		usage.innerHTML = `
			<h3>Usage</h3>
			<p>Type <code>${this.plugin.settings.triggerWord}</code> in your text. It becomes invisible in reading mode and creates a line break.</p>
			<p><strong>Example:</strong> "First line${this.plugin.settings.triggerWord}Second line" becomes:</p>
			<p>First line<br>Second line</p>
		`;
	}
}