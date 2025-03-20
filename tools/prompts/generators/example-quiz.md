```json
{
  "_id": {
    "$oid": "67c4c703e20436f3df698c7d"
  },
  "compStatus": "COMPLETED",
  "convStatus": "NOT_STARTED",
  "genStatus": "COMPLETED",
  "feedbackStatus": "COMPLETED",
  "metadata": {
    "title": "English Basics: Getting Started",
    "description": "A beginner-friendly quiz to assess your basic English knowledge covering simple vocabulary, grammar, and everyday expressions.",
    "estimatedDuration": 15,
    "focusAreas": [
      "basic vocabulary",
      "simple grammar",
      "everyday expressions"
    ],
    "focusSkills": ["vocabulary", "grammar", "reading"],
    "id": "quiz1"
  },
  "journey_ID": {
    "$oid": "67c4b87fd73a1bb07fc5245f"
  },
  "user_ID": {
    "$oid": "67c08a7d9a5c59c88a434be7"
  },
  "pathID": "8469bcecfa318971bcd752e97d269edf5322bdd1943a36db",
  "type": "QUIZ",
  "createdAt": 1740949251923,
  "updatedAt": 1740951407786,
  "details": {
    "preludes": [
      {
        "id": "prelude1",
        "parts": [
          {
            "type": "TEXT",
            "content": "Emily regularly stops at a local café during her morning walks. She enjoys sitting by the large glass window while sipping a warm beverage and watching the busy street outside."
          },
          {
            "type": "PICTURE",
            "picturePrompt": "A cozy café interior with warm lighting. A woman with brown hair seated at a small table next to a large window. She has a steaming cup in front of her and is gazing at the pedestrians on a sunny street outside.",
            "pictureId": "67c4c74be20436f3df698c8a"
          }
        ]
      },
      {
        "id": "prelude2",
        "parts": [
          {
            "type": "TEXT",
            "content": "The Thompson household is bustling with activity on weekends. Each family member engages in their preferred leisure activities throughout their home."
          },
          {
            "type": "PICTURE",
            "picturePrompt": "A bright living room scene showing a family of four. The parents and two children are engaged in different activities - one absorbed in a novel, another playing with colorful building blocks, one using a tablet, and another arranging photos in an album.",
            "pictureId": "67c4c74be20436f3df698c8b"
          }
        ]
      },
      {
        "id": "prelude3",
        "parts": [
          {
            "type": "TEXT",
            "content": "Lisa is a professional who works in a busy corporate office in the city center. Today, her schedule is packed with various assignments that must be completed before the deadline."
          },
          {
            "type": "PICTURE",
            "picturePrompt": "A modern office setting with a professionally dressed woman focused on her work. Her desk has a computer monitor, several folders, a notepad with a pen, and a small decorative plant. The office has large windows showing a city skyline.",
            "pictureId": "67c4c74be20436f3df698c8c"
          }
        ]
      },
      {
        "id": "prelude4",
        "parts": [
          {
            "type": "TEXT",
            "content": "People in different professions have specific responsibilities and work environments that shape their daily activities."
          }
        ]
      },
      {
        "id": "prelude5",
        "parts": [
          {
            "type": "TEXT",
            "content": "Throughout the day, people perform various activities in a sequence that forms their daily routine."
          }
        ]
      }
    ],
    "questions": [
      {
        "type": "MULTIPLE_CHOICE",
        "question": "What objects might you typically find in a café?",
        "id": "q1",
        "preludeID": "prelude1",
        "choices": [
          {
            "id": "q1c1",
            "text": "Cups and mugs"
          },
          {
            "id": "q1c2",
            "text": "Baked goods"
          },
          {
            "id": "q1c3",
            "text": "Tables and chairs"
          },
          {
            "id": "q1c4",
            "text": "Cars and bicycles"
          }
        ],
        "secondaryChoices": null
      },
      {
        "type": "CHOICE",
        "question": "What is Emily doing at the café?",
        "id": "q2",
        "preludeID": "prelude1",
        "choices": [
          {
            "id": "q2c1",
            "text": "Observing people on the street"
          },
          {
            "id": "q2c2",
            "text": "Making coffee for customers"
          },
          {
            "id": "q2c3",
            "text": "Cleaning the furniture"
          },
          {
            "id": "q2c4",
            "text": "Meeting with colleagues"
          }
        ],
        "secondaryChoices": null
      },
      {
        "type": "TRUE_FALSE",
        "question": "Based on the information provided, Emily prefers cold beverages.",
        "id": "q3",
        "preludeID": "prelude1",
        "choices": null,
        "secondaryChoices": null
      },
      {
        "type": "FILL_CHOICE",
        "question": "Emily visits the café during her {blank1} activities.",
        "id": "q4",
        "preludeID": "prelude1",
        "choices": [
          {
            "id": "q4c1",
            "text": "morning"
          },
          {
            "id": "q4c2",
            "text": "afternoon"
          },
          {
            "id": "q4c3",
            "text": "evening"
          },
          {
            "id": "q4c4",
            "text": "nighttime"
          }
        ],
        "secondaryChoices": null
      },
      {
        "type": "CHOICE",
        "question": "When is the Thompson family most active at home?",
        "id": "q5",
        "preludeID": "prelude2",
        "choices": [
          {
            "id": "q5c1",
            "text": "During weekends"
          },
          {
            "id": "q5c2",
            "text": "On workdays"
          },
          {
            "id": "q5c3",
            "text": "After school hours"
          },
          {
            "id": "q5c4",
            "text": "During mealtimes"
          }
        ],
        "secondaryChoices": null
      },
      {
        "type": "MULTIPLE_CHOICE",
        "question": "What leisure activities can be seen in the Thompson home?",
        "id": "q6",
        "preludeID": "prelude2",
        "choices": [
          {
            "id": "q6c1",
            "text": "Reading books"
          },
          {
            "id": "q6c2",
            "text": "Building with blocks"
          },
          {
            "id": "q6c3",
            "text": "Using digital devices"
          },
          {
            "id": "q6c4",
            "text": "Swimming"
          }
        ],
        "secondaryChoices": null
      },
      {
        "type": "FILL_WRITE",
        "question": "The Thompson {blank1} members spend their free time at {blank2}.",
        "id": "q7",
        "preludeID": "prelude2",
        "choices": null,
        "secondaryChoices": null,
        "expectedAnswers": {
          "blank1": ["family", "household"],
          "blank2": ["home", "house", "residence"]
        }
      },
      {
        "type": "MATCHING",
        "question": "Match the people with their likely activities:",
        "id": "q8",
        "preludeID": "prelude4",
        "choices": [
          {
            "id": "q8c1",
            "text": "A young child"
          },
          {
            "id": "q8c2",
            "text": "A café employee"
          },
          {
            "id": "q8c3",
            "text": "An office worker"
          },
          {
            "id": "q8c4",
            "text": "A parent"
          }
        ],
        "secondaryChoices": [
          {
            "id": "q8sc1",
            "text": "Playing with toys"
          },
          {
            "id": "q8sc2",
            "text": "Preparing beverages"
          },
          {
            "id": "q8sc3",
            "text": "Using a computer"
          },
          {
            "id": "q8sc4",
            "text": "Helping with homework"
          }
        ]
      },
      {
        "type": "ORDERING",
        "question": "Arrange these common daily activities in a logical sequence from morning to night:",
        "id": "q9",
        "preludeID": "prelude5",
        "choices": [
          {
            "id": "q9c1",
            "text": "Going to work or school"
          },
          {
            "id": "q9c2",
            "text": "Getting out of bed"
          },
          {
            "id": "q9c3",
            "text": "Eating breakfast"
          },
          {
            "id": "q9c4",
            "text": "Going to sleep"
          }
        ],
        "secondaryChoices": null,
        "expectedOrder": ["q9c2", "q9c3", "q9c1", "q9c4"]
      },
      {
        "type": "CHOICE",
        "question": "Where does Lisa carry out her professional responsibilities?",
        "id": "q10",
        "preludeID": "prelude3",
        "choices": [
          {
            "id": "q10c1",
            "text": "In a corporate setting downtown"
          },
          {
            "id": "q10c2",
            "text": "At a neighborhood café"
          },
          {
            "id": "q10c3",
            "text": "From her home"
          },
          {
            "id": "q10c4",
            "text": "In a medical facility"
          }
        ],
        "secondaryChoices": null
      },
      {
        "type": "TEXT_WRITE",
        "question": "Name at least two items visible on Lisa's workspace.",
        "id": "q11",
        "preludeID": "prelude3",
        "choices": null,
        "secondaryChoices": null,
        "assessmentCriteria": "Answer should mention at least two of: computer/monitor, folders, notepad, pen, plant. Accept synonyms or reasonable alternatives."
      },
      {
        "type": "RECORD",
        "question": "Describe what type of career Lisa might have based on her work environment.",
        "id": "q12",
        "preludeID": "prelude3",
        "choices": null,
        "secondaryChoices": null,
        "assessmentCriteria": "Response should reasonably connect Lisa's office setting to a corporate profession such as business analyst, manager, administrator, or similar professional role. Should mention aspects from the prelude that support their answer."
      }
    ],
    "type": "QUIZ"
  }
}
```
