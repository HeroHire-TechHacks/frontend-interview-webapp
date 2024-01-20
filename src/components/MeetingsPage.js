import React, { useState, useEffect, useRef } from 'react';
import { pages } from '../App';

import declineIcon from '../assets/decline.svg';
import micIcon from '../assets/microphone.svg';
import checkIcon from '../assets/check.svg';
import adityaIcon from '../assets/aditya.png';

import './MeetingsPage.css';

const meetingStates = {
	ready: 'ready',
	started: 'started',
	finished: 'finished',
};

const micButtonStates = {
	disabled: 'disabled',
	pressed: 'pressed',
	normal: 'normal',
};

const speakers = {
	interviewer: 'interviewer',
	candidate: 'candidate',
};

const MeetingsPage = ({ changePage }) => {
	const [userToken, setUserToken] = useState('');
	const [meetCode, setMeetCode] = useState('');
	const [meetingState, setMeetingState] = useState(meetingStates.ready);
	const [micButtonState, setMicButtonState] = useState(
		micButtonStates.disabled
	);
	const [currentSpeaker, setCurrentSpeaker] = useState(speakers.interviewer);
	const [isInterviwerLoading, setIsInterviwerLoading] = useState(true);
	const [messageHistory, setMessageHistory] = useState([]);
	const [currentAudio, setCurrentAudio] = useState(null);

	const [permission, setPermission] = useState(false);
	const mediaRecorder = useRef(null);
	const [recordingStatus, setRecordingStatus] = useState('inactive');
	const [stream, setStream] = useState(null);
	const [audioChunks, setAudioChunks] = useState([]);
	const [audio, setAudio] = useState(null);

	const getMicrophonePermission = async () => {
		if ('MediaRecorder' in window) {
			try {
				const streamData = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				setPermission(true);
				setStream(streamData);
			} catch (err) {
				console.log(err);
				setPermission(false);
				alert(
					'You have blocked the microphone access. Please allow it from your browser settings to continue.'
				);

				return 'nopermission';
			}
		} else {
			alert('The MediaRecorder API is not supported in your browser.');
		}
	};
	const mimeType = 'audio/mpeg';

	const startRecording = async () => {
		setRecordingStatus('recording');
		//create new Media recorder instance using the stream
		const media = new MediaRecorder(stream, { type: mimeType });
		//set the MediaRecorder instance to the mediaRecorder ref
		mediaRecorder.current = media;
		//invokes the start method to start the recording process
		mediaRecorder.current.start();
		let localAudioChunks = [];
		mediaRecorder.current.ondataavailable = (event) => {
			if (typeof event.data === 'undefined') return;
			if (event.data.size === 0) return;
			localAudioChunks.push(event.data);
		};
		setAudioChunks(localAudioChunks);
	};

	const stopRecording = async () => {
		setRecordingStatus('inactive');
		//stops the recording instance
		mediaRecorder.current.stop();
		mediaRecorder.current.onstop = () => {
			//creates a blob file from the audiochunks data
			const audioBlob = new Blob(audioChunks, { type: mimeType });

			const reader = new FileReader();
			reader.readAsDataURL(audioBlob);
			reader.onloadend = async () => {
				const base64Data = reader.result.split(',')[1];
				// save conversation
				const saveConversationResponse = await fetch(
					process.env.REACT_APP_BACKEND_URL + '/save-conversation',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'x-auth-token': userToken,
						},
						body: JSON.stringify({
							meetCode: meetCode,
							base64Audio: base64Data,
						}),
					}
				);

				const saveConversationData = await saveConversationResponse.json();

				if (saveConversationData.error) {
					alert('Some error occurred. Please try again later.');
					setMeetingState(meetingStates.finished);
					return;
				}

				// request next message
				const nextMessageResponse = await fetch(
					process.env.REACT_APP_BACKEND_URL + '/next-message',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'x-auth-token': userToken,
						},
						body: JSON.stringify({
							meetCode: meetCode,
						}),
					}
				);

				const nextMessageData = await nextMessageResponse.json();

				if (nextMessageData.error) {
					if (nextMessageData.message === 'conversation_limit_reached') {
						return handleLimitExceeded();
					} else {
						alert('Some error occurred. Please refresh.');
						setMeetingState(meetingStates.finished);

						return;
					}
				} else {
					setIsInterviwerLoading(false);

					setMessageHistory((messageHistory) => [
						...messageHistory,
						{
							conversationId: nextMessageData.data.conversationId,
							conversationText: nextMessageData.data.conversationText,
							conversationAudio: nextMessageData.data.conversationAudio,
						},
					]);

					await speakMessage(nextMessageData.data.conversationAudio);

					setMicButtonState(micButtonStates.normal);
					setCurrentSpeaker(speakers.candidate);
				}
			};

			//creates a playable URL from the blob file.
			const audioUrl = URL.createObjectURL(audioBlob);
			setAudio(audioUrl);
			setAudioChunks([]);
		};
	};

	const speakMessage = async (conversationAudio) => {
		try {
			const audioBlob = await fetch(
				`data:audio/wav;base64,${conversationAudio}`
			).then((res) => res.blob());

			const audioUrl = URL.createObjectURL(audioBlob);

			const audio = new Audio(audioUrl);

			setCurrentAudio({
				audio,
				audioUrl,
			});

			// Create a promise that resolves when audio playback is finished
			const audioPromise = new Promise((resolve, reject) => {
				audio.addEventListener('ended', () => {
					resolve();
				});

				audio.addEventListener('error', (error) => {
					reject(error);
				});
			});

			// Start audio playback
			audio.play();

			// Wait for the promise to resolve when playback is finished
			await audioPromise;

			// Cleanup the URL object
			URL.revokeObjectURL(audioUrl);
		} catch (err) {
			console.log(err);
			alert('Some error occurred. Please try again later.');
			setMeetingState(meetingStates.finished);
		}
	};

	const handleLimitExceeded = async () => {
		setMeetingState(meetingStates.finished);

		const shouldReachOut = window.confirm(
			'This is just a prototype of the final product. To prevent abuse, we have limited the number of conversations per user. Please reach out to us if you want to try more.'
		);

		if (shouldReachOut) {
			window.location.href = 'https://dub.sh/x-akg-conversation-end';
		}

		return;
	};

	const generateFirstQuestion = async () => {
		try {
			const firstQuestionResponse = await fetch(
				process.env.REACT_APP_BACKEND_URL + '/first-message',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-auth-token': userToken,
					},
					body: JSON.stringify({
						meetCode: meetCode,
					}),
				}
			);

			const firstQuestionResponseData = await firstQuestionResponse.json();

			if (firstQuestionResponseData.error) {
				if (
					firstQuestionResponseData.message === 'conversation_limit_reached'
				) {
					return handleLimitExceeded();
				} else {
					throw new Error('Some error occurred. Please refresh.');
				}
			} else {
				setIsInterviwerLoading(false);

				setMessageHistory((messageHistory) => [
					...messageHistory,
					{
						conversationId: firstQuestionResponseData.data.conversationId,
						conversationText: firstQuestionResponseData.data.conversationText,
						conversationAudio: firstQuestionResponseData.data.conversationAudio,
					},
				]);

				await speakMessage(firstQuestionResponseData.data.conversationAudio);

				setMicButtonState(micButtonStates.normal);
				setCurrentSpeaker(speakers.candidate);
			}
		} catch (err) {
			console.log(err);
			alert('Some error occurred. Please try again later.');
			setMeetingState(meetingStates.finished);
		}
	};

	const handleStartMeeting = async () => {
		try {
			if (!permission) {
				const permissionGranted = await getMicrophonePermission();

				if (permissionGranted === 'nopermission') {
					return;
				}
			}

			setMicButtonState(micButtonStates.disabled);
			setCurrentSpeaker(speakers.interviewer);
			setIsInterviwerLoading(true);

			const startMeetResponse = await fetch(
				process.env.REACT_APP_BACKEND_URL + '/start-meet',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-auth-token': userToken,
					},
					body: JSON.stringify({
						meetCode: meetCode,
					}),
				}
			);

			const startMeetResponseData = await startMeetResponse.json();

			if (startMeetResponseData.error) {
				throw new Error(
					'Some error occurred while starting meeting. Please refresh.'
				);
			} else {
				setMeetingState(meetingStates.started);
				await generateFirstQuestion();
			}
		} catch (err) {
			console.log(err);
			alert('Some error occurred while starting meeting. Please refresh.');
			setMeetingState(meetingStates.finished);
		}
	};

	const handleEndMeeting = async () => {
		try {
			window.localStorage.removeItem('userToken');
			window.localStorage.removeItem('meetCode');

			const endMeetResponse = await fetch(
				process.env.REACT_APP_BACKEND_URL + '/end-meet',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-auth-token': userToken,
					},
					body: JSON.stringify({
						meetCode: meetCode,
						meetEndReason: 'ended by user by clicking end meet button',
					}),
				}
			);

			const endMeetResponseData = await endMeetResponse.json();

			if (endMeetResponseData.error) {
				throw new Error(
					'Some error occurred while ending meeting. Please refresh.'
				);
			}

			setMeetingState(meetingStates.finished);
		} catch (err) {
			console.log(err);
			alert('Some error occurred while ending meeting. Please refresh.');
			setMeetingState(meetingStates.finished);
		}
	};

	const handleMicButtonClick = async () => {
		setCurrentSpeaker(speakers.candidate);
		setIsInterviwerLoading(false);
		setMicButtonState(micButtonStates.pressed);

		startRecording();
	};

	const handleMicButtonRelease = async () => {
		setCurrentSpeaker(speakers.interviewer);
		setIsInterviwerLoading(true);
		setMicButtonState(micButtonStates.disabled);

		await stopRecording();
	};

	const stopAudio = () => {
		if (!currentAudio || !currentAudio.audio || !currentAudio.audioUrl) return;

		currentAudio.audio.pause();
		URL.revokeObjectURL(currentAudio.audioUrl);
	};

	const getTime = () => {
		// Example: 10:50AM
		const currentDate = new Date();

		// Extract the hours and minutes
		const hours = currentDate.getHours();
		const minutes = currentDate.getMinutes();

		// Determine whether it's AM or PM
		const period = hours >= 12 ? ' PM' : ' AM';

		// Convert to 12-hour format
		const formattedHours = hours % 12 || 12; // Ensure 12:00 is displayed as 12:00 PM/AM

		// Format the time as "HH:MMAM/PM"
		const formattedTime = `${formattedHours}:${
			minutes < 10 ? '0' : ''
		}${minutes}${period}`;

		return formattedTime;
	};

	useEffect(() => {
		const utoken = window.localStorage.getItem('userToken');
		const mCode = window.localStorage.getItem('meetCode');

		if (!utoken || !mCode || !utoken.trim() || !mCode.trim()) {
			window.localStorage.removeItem('userToken');
			window.localStorage.removeItem('meetCode');
			changePage(pages.info);
			return;
		}

		setUserToken(utoken);
		setMeetCode(mCode);

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="page">
			{meetingState === meetingStates.finished ? (
				<div className="meet-finish-container">
					{stopAudio()}
					{window.localStorage.removeItem('userToken')}
					{window.localStorage.removeItem('meetCode')}
					<p className="meet-finish-text">
						Meeting Ended. You can now close this tab or go to home page.
					</p>
					<button
						className="meeting-primary-button"
						onClick={() => changePage(pages.info)}
					>
						Go to Home Page
					</button>
				</div>
			) : (
				<div className="page-inner-container">
					<div className="main-container">
						{meetingState === meetingStates.ready ? (
							<div className="meeting-instructions-container">
								<p className="meeting-instructions-text">
									To speak, tap the microphone icon.
									<br />
									Tap it again when done speaking.
								</p>
								<button
									className="meeting-primary-button"
									onClick={handleStartMeeting}
								>
									Start Meeting
								</button>
							</div>
						) : (
							<div className="chat-container">
								{messageHistory.map((message) => (
									<div className="chat-group" key={message.conversationId}>
										<img
											src={adityaIcon}
											alt="Aditya"
											className="aditya-image"
										/>
										<div className="chat-message-container">
											<p className="aditya-says">Aditya Says</p>
											<div className="message-bubble">
												<p className="message">{message.conversationText}</p>
											</div>
											<p className="message-time">{getTime()}</p>
										</div>
									</div>
								))}

								{isInterviwerLoading ? (
									<div className="chat-group">
										<img
											src={adityaIcon}
											alt="Aditya"
											className="aditya-image"
										/>
										<div className="chat-message-container">
											<p className="aditya-says">Aditya is thinking</p>
											<div className="message-bubble">
												<p className="message thinking">...</p>
											</div>
										</div>
									</div>
								) : null}
							</div>
						)}
					</div>
					<div className="controls-container">
						<div
							className="control-container control-end"
							title="End Meeting"
							onClick={handleEndMeeting}
						>
							<img
								src={declineIcon}
								className="control-icon icon-end"
								alt="End Meeting"
							/>
						</div>
						<div
							className={`control-container control-mic-${micButtonState}`}
							title={
								micButtonState === micButtonStates.pressed
									? 'Click to stop speaking'
									: micButtonState === micButtonStates.disabled
									? "Can't speak yet"
									: 'Click to speak'
							}
							onClick={
								micButtonState === micButtonStates.pressed
									? handleMicButtonRelease
									: micButtonState === micButtonStates.disabled
									? null
									: handleMicButtonClick
							}
						>
							{micButtonState === micButtonStates.pressed ? (
								<img
									src={checkIcon}
									className="control-icon icon-check"
									alt="Check"
								/>
							) : (
								<img
									src={micIcon}
									className="control-icon icon-mic"
									alt="Mic"
								/>
							)}
						</div>
					</div>
					{micButtonState === micButtonStates.pressed ? (
						<p className="timer">You are speaking</p>
					) : null}
				</div>
			)}
		</div>
	);
};

export default MeetingsPage;
