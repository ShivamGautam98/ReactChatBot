import React, { useState, useRef } from 'react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { MainContainer, ChatContainer, MessageList, Message, MessageInput, TypingIndicator } from '@chatscope/chat-ui-kit-react';

const API_KEY = "<OPENAI API KEY>";

let doc_embedding = [];

function App() {
  const [messages, setMessages] = useState([
    {
      message: "Hello, I'm Jarvis! Ask me anything!",
      sentTime: "just now",
      sender: "Jarvis"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef(null);
  const [lastUserMessage, setLastUserMessage] = useState(""); // State to store the last user message

  const handleSend = async (message) => {
    const newMessage = {
      message,
      direction: 'outgoing',
      sender: "user"
    };
    setLastUserMessage(message); // Update last user message
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setIsTyping(true);
    await processMessageToJarvis(newMessages);
  };

  const handleFileUpload = async (files) => {
    const uploadedFile = files[0];
    if (uploadedFile.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const name = uploadedFile.name
        const uploadedTextMessage = {
          message: `Uploaded text file: ${uploadedFile.name}`,
          sentTime: "just now",
          sender: "user"
        };
        console.log(`${text}`);
        await getEmbeddings(text, name); // Wait for embeddings before setting messages
        setMessages([...messages, uploadedTextMessage]);
      };
      reader.readAsText(uploadedFile);

    } else {
      console.error("Invalid file type. Please upload a text file.");
    }
  };


  const handleSeparateFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click(); // Trigger file input click
    }
  };

  async function getEmbeddings(text, name) {
    const apiRequestBody = {
      "input": text,
      "model": "text-embedding-ada-002",
    };

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(apiRequestBody)
      });

      if (!response.ok) {
        console.log('API Request Body:', JSON.stringify(apiRequestBody));
        throw new Error(`Network response was not ok - Status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      console.log('API Response:', { "text": text, "name": name, "embedding": data["data"][0]["embedding"] });
      doc_embedding.push({ "text": text, "name": name, "embedding": data["data"][0]["embedding"] });
    } catch (error) {
      console.error('Error:', error.message);
    }
  }


  async function processMessageToJarvis(chatMessages) {
    try {
      const lastUserMessageIndex = chatMessages.findIndex(msg => msg.sender === 'user');
      if (chatMessages.length === 0) {
        console.log('No user messages found');
        return;
      }

      const lastUserMessage = chatMessages[chatMessages.length - 1].message;
      const apiRequestBodyEmbeddings = {
        "input": lastUserMessage,
        "model": "text-embedding-ada-002",
      };

      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(apiRequestBodyEmbeddings)
      });

      const data = await response.json();
      let currentPromptEmbedding = { "text": lastUserMessage, "embedding": data["data"][0]["embedding"] }
      const mostSimilarDocument = findMostSimilarDocument(currentPromptEmbedding.embedding);

      if (mostSimilarDocument) {
        const similarityScore = cosineSimilarity(currentPromptEmbedding.embedding, mostSimilarDocument.embedding);
        const similarDocumentMessage = {
          message: `Most similar document: ${mostSimilarDocument.name}, Similarity: ${similarityScore.toFixed(4)}`,
          sentTime: 'just now',
          sender: 'Jarvis'
        };
        setIsTyping(true);
        // Add the similar document message to the messages array
        setMessages(prevMessages => [...prevMessages, similarDocumentMessage]); // Use previous messages
        setIsTyping(false);
        const finalPrompt = `
        Give elaborate answers by taking help from this text: ${mostSimilarDocument.text}'
        Question: ${lastUserMessage}
        Answer:
      `;

        console.log('final prompt:', finalPrompt);
        const apiRequestBodyCompletion = {
          "model": "text-davinci-003",
          "prompt": finalPrompt,
          temperature: 0,
          max_tokens: 200
        };

        try {
          const response = await fetch("https://api.openai.com/v1/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(apiRequestBodyCompletion)
          });

          if (!response.ok) {
            console.log('API Request Body:', JSON.stringify(apiRequestBodyCompletion));
            throw new Error(`Network response was not ok - Status: ${response.status} ${response.statusText}`);
          }

          const responseData = await response.json();
          console.log('API Response:', responseData);
          setIsTyping(true);
          // setMessages(prevMessages => [...prevMessages, responseData.choices[0].text]);
          setMessages([
            ...chatMessages, similarDocumentMessage,
            {
              message: responseData.choices[0].text,
              sender: "Jarvis"
            }
          ]);
          setIsTyping(false);
        } catch (error) {
          console.error('Error:', error.message);
        }
      } else {
        const errorMessage = {
          message: 'No similar document found.',
          sentTime: 'just now',
          sender: 'Jarvis'
        };

        // Add the error message to the messages array
        setMessages(prevMessages => [...prevMessages, errorMessage]); // Use previous messages
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
  function downloadEmbeddingsCSV() {
    const csvContent = doc_embedding.map(({ text, embedding }) => {
      // Replace newlines with spaces in the text
      text = text.split(/\r?\n/).join(' ').replace(/,/g, ''); // Replace newlines with spaces and remove commas

      // Ensure any commas in the text are appropriately handled
      text = text.includes(',') ? `"${text}"` : text;

      return `${text},${embedding.join(',')}`;
    }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'accumulated_embeddings.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  // Function to calculate cosine similarity between two vectors
  function cosineSimilarity(vectorA, vectorB) {
    const dotProduct = vectorA.reduce((acc, curr, index) => acc + curr * vectorB[index], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((acc, curr) => acc + curr * curr, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((acc, curr) => acc + curr * curr, 0));

    if (magnitudeA && magnitudeB) {
      const similarity = dotProduct / (magnitudeA * magnitudeB);
      return similarity;
    } else {
      return 0; // Handle division by zero
    }
  }

  // Calculate cosine similarity between current prompt and document embeddings
  function findMostSimilarDocument(currentPromptEmbedding) {
    let maxSimilarity = -1;
    let mostSimilarDocument = null;

    for (const doc of doc_embedding) {
      const similarity = cosineSimilarity(currentPromptEmbedding, doc.embedding);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarDocument = doc;
      }
    }

    return mostSimilarDocument;
  }


  return (
    <div className="App">
      <input
        type="file"
        ref={fileInputRef}
        style={{ position: 'absolute', left: '-9999px' }} // Position off-screen
        onChange={(e) => handleFileUpload(e.target.files)}
      />
      <div style={{ position: "relative", height: "550px", width: "1200px" }}>
        <MainContainer>
          <ChatContainer>
            <MessageList
              scrollBehavior="smooth"
              typingIndicator={isTyping ? <TypingIndicator content="Jarvis is typing" /> : null}
            >
              {messages.map((message, i) => {
                return <Message key={i} model={message} />
              })}
            </MessageList>
            <MessageInput placeholder="Type message here" onSend={handleSend} onAttachClick={handleSeparateFileUpload} />
          </ChatContainer>
        </MainContainer>
        <button onClick={downloadEmbeddingsCSV}>Download Embeddings</button>
      </div>
    </div>
  );
}

export default App;