import { useState } from 'react';
import './app.css';
import InfoPage from './components/InfoPage';

export const pages = {
	info: 'info',
	meetings: 'meetings',
};

const App = () => {
	const [currentPage, setCurrentPage] = useState(pages.info);

	return (
		<div className="app">
			<div className="mobile">
				<p>
					This website is currently not supported on mobile. Please open it on
					Desktop. Preferably Chrome browser.
				</p>
			</div>
			<div className="desktop">
				<InfoPage />
			</div>
		</div>
	);
};

export default App;
