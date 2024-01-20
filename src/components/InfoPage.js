import React, { useEffect, useState } from 'react';

import './InfoPage.css';
import { pages } from '../App';

const loginButtonActions = {
	sendEmail: 'sendEmail',
	joinMeet: 'joinMeet',
};

const InfoPage = ({ changePage }) => {
	window.localStorage.removeItem('userToken');
	window.localStorage.removeItem('meetCode');

	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [cvBase64, setCVBase64] = useState('sample value');
	const [meetCode, setMeetCode] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [userOtp, setUserOtp] = useState('');
	const [loginButtonAction, setLoginButtonAction] = useState(
		loginButtonActions.sendEmail
	);

	useEffect(() => {
		const savedUserName = window.localStorage
			.getItem('userName')
			?.toString()
			.trim();
		const savedUserEmail = window.localStorage
			.getItem('userEmail')
			?.toString()
			.trim();

		if (savedUserEmail && savedUserName) {
			setName(savedUserName);
			setEmail(savedUserEmail);
		}
	}, []);

	function readFileAsBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = () => {
				const base64String = reader.result.match(/base64,(.*)$/)[1];
				resolve(base64String);
			};

			reader.onerror = (error) => {
				reject(error);
			};

			reader.readAsDataURL(file);
		});
	}

	const handleFileChange = async (event) => {
		const file = event.target.files[0];

		if (file.size > 1000000) {
			setCVBase64('');
			event.target.value = null;
			alert('File size should not be greater than 1 MB.');
			return;
		}

		if (file) {
			try {
				setIsLoading(true);
				const base64 = await readFileAsBase64(file);
				setCVBase64(base64);
				setIsLoading(false);
			} catch (error) {
				setCVBase64('');
				event.target.value = null;
				alert('Error while reading the uploaded CV file.');
			}
		}
	};

	const joinMeetingAndRedirect = async (userToken) => {
		try {
			setIsLoading(true);
			const generateMeetCodeResponse = await fetch(
				process.env.REACT_APP_BACKEND_URL + '/create-meet',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-auth-token': userToken,
					},
				}
			);

			const generateMeetCodeResponseData =
				await generateMeetCodeResponse.json();

			if (generateMeetCodeResponseData.error) {
				alert(generateMeetCodeResponseData.message);
				setIsLoading(false);
				return;
			}

			// redirect to meetings page
			window.localStorage.setItem('userName', name);
			window.localStorage.setItem('userEmail', email);
			window.localStorage.setItem('userToken', userToken);
			window.localStorage.setItem(
				'meetCode',
				generateMeetCodeResponseData.data
			);

			setIsLoading(false);
			changePage(pages.meetings);
		} catch (err) {
			console.log(err);
			window.localStorage.removeItem('userToken');
			window.localStorage.removeItem('meetCode');
			setIsLoading(false);
			alert('Some error occurred. Please try again later.');
			return;
		}
	};

	const handleVerifyOtpAndJoinMeet = async () => {
		try {
			if (loginButtonAction !== loginButtonActions.joinMeet) {
				return;
			}

			setIsLoading(true);

			if (!userOtp || !email || !userOtp.trim() || !email.trim()) {
				alert('Please fill in the email and the OTP');
				setIsLoading(false);
				return;
			}

			if (userOtp.length !== 6) {
				alert('Please enter a valid OTP');
				setIsLoading(false);
				return;
			}

			const verifyOtpResponse = await fetch(
				process.env.REACT_APP_BACKEND_URL + '/verify-otp',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ email, otp: userOtp }),
				}
			);

			const verifyOtpResponseData = await verifyOtpResponse.json();

			if (verifyOtpResponseData.error) {
				alert(verifyOtpResponseData.message);
				setIsLoading(false);
				return;
			}

			// passing userToken
			await joinMeetingAndRedirect(verifyOtpResponseData.data);
		} catch (err) {
			console.log(err);
			setIsLoading(false);
			window.localStorage.removeItem('userToken');
			window.localStorage.removeItem('meetCode');
			alert('Some error occurred. Please try again later.');
			return;
		}
	};

	const handleSendOtpOrJoinMeet = async () => {
		try {
			if (loginButtonAction !== loginButtonActions.sendEmail) {
				return;
			}

			setIsLoading(true);

			if (!name || !email || !name.trim() || !email.trim()) {
				alert('Please fill all the details marked with *.');
				setIsLoading(false);
				return;
			}

			const loginResponse = await fetch(
				process.env.REACT_APP_BACKEND_URL + '/login',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ email, name }),
				}
			);

			const loginResponseData = await loginResponse.json();

			if (loginResponseData.error) {
				alert(loginResponseData.message);
				setIsLoading(false);
				return;
			}

			if (loginResponseData.data === 'email_sent') {
				alert(
					'An email has been sent to your email address. Please enter the OTP to verify your email address.'
				);

				setLoginButtonAction(loginButtonActions.joinMeet);

				setIsLoading(false);

				return;
			}

			if (loginResponseData.data === 'email_already_sent') {
				alert(
					'An email has already been sent to your email address in the last 10 minutes. Please enter the OTP to verify your email address.'
				);

				setLoginButtonAction(loginButtonActions.joinMeet);

				setIsLoading(false);

				return;
			}

			// passing userToken
			await joinMeetingAndRedirect(loginResponseData.data);
		} catch (err) {
			console.log(err);
			setIsLoading(false);
			window.localStorage.removeItem('userToken');
			window.localStorage.removeItem('meetCode');
			alert('Some error occurred. Please try again later.');
			return;
		}
	};

	return (
		<div className="info-page">
			<div className="login-card">
				<div className="login-card-header">
					<h2 className="login-header-heading">HeroHire</h2>
					<p className="login-header-subtext">
						Enter the following details to join the meeting
					</p>
				</div>
				<div className="form">
					<div className="form-input-group">
						<label className="form-label" htmlFor="name">
							Name <span className="star-required">*</span>
						</label>
						<input
							className="form-input input-text"
							type="text"
							id="name"
							name="name"
							placeholder="Aditya Gupta"
							onChange={(event) => setName(event.target.value)}
							value={name}
						/>
					</div>
					<div className="form-input-group">
						<label className="form-label" htmlFor="email">
							Email <span className="star-required">*</span>
						</label>
						<input
							className="form-input input-text"
							type="email"
							id="email"
							name="email"
							placeholder="aditya@gmail.com"
							onChange={(event) => setEmail(event.target.value)}
							value={email}
						/>
					</div>
					<div className="form-input-group">
						<label className="form-label" htmlFor="meetCode">
							Meeting Code <span className="star-required">*</span>
						</label>
						<input
							className="form-input input-button"
							type="text"
							id="meetCode"
							name="meetCode"
							placeholder="XXXXXX"
							onChange={(event) => setMeetCode(event.target.value)}
							value={meetCode}
						/>
					</div>
					{loginButtonAction === loginButtonActions.joinMeet ? (
						<div className="form-input-group otp-group">
							<label className="form-label" htmlFor="otp">
								OTP <span className="star-required">*</span>
							</label>
							<input
								className="form-input input-text"
								type="text"
								id="otp"
								name="otp"
								placeholder="123456"
								onChange={(event) => setUserOtp(event.target.value)}
							/>
						</div>
					) : null}
					<button
						className={`form-input input-button button-join-meeting ${
							isLoading ? 'main-button-disabled' : ''
						}`}
						onClick={
							isLoading
								? null
								: loginButtonAction === loginButtonActions.sendEmail
								? handleSendOtpOrJoinMeet
								: handleVerifyOtpAndJoinMeet
						}
					>
						{isLoading
							? 'Loading...'
							: loginButtonAction === loginButtonActions.joinMeet
							? 'Verify & Join Meeting'
							: 'Join Meeting'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default InfoPage;
