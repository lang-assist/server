// import { WithId } from "mongodb";
// import { IJourney, IUserPath } from "../../models/_index";
// import {
//   QuizDetails,
//   QuizPrelude,
//   QuizQuestion,
// } from "../../utils/content-types";
// import { AIModel } from "./base";
// import { randomColor } from "../../utils/random";
// import { AIGeneratedContentResponse } from "../../utils/ai-types";

// const quizPreludes: QuizPrelude[] = [
//   // Tech & Business
//   {
//     id: "story-1",
//     type: "STORY",
//     // content:
//     //   "John is a software developer who works at a tech company. He loves coding and solving problems. Every day, he collaborates with his team to build amazing applications.",
//     content: [
//       {
//         expr: "John",
//         type: "SPECIAL",
//       },
//       {
//         expr: "is",
//         type: "VERB",
//       },
//       {
//         expr: "a",
//         type: "ADJECTIVE",
//       },
//       {
//         expr: "software developer",
//         type: "NOUN",
//       },
//     ],
//   },
//   {
//     id: "story-2",
//     type: "STORY",
//     content:
//       "Sarah is a chef at a famous restaurant. She creates delicious dishes using fresh ingredients. Her specialty is Italian cuisine, and she loves teaching others about cooking.",
//   },
//   // Travel
//   {
//     id: "story-3",
//     type: "STORY",
//     content:
//       "Emma is traveling through Europe for the first time. She started her journey in Paris, where she visited the Eiffel Tower and enjoyed French cuisine. Now she's in Rome, exploring ancient ruins and trying authentic Italian pizza.",
//   },
//   // Daily Life
//   {
//     id: "story-4",
//     type: "STORY",
//     content:
//       "David lives in a small apartment in the city center. Every morning, he wakes up early to go jogging in the nearby park. After his morning exercise, he prepares a healthy breakfast and reads the news before heading to work.",
//   },
//   // Education
//   {
//     id: "story-5",
//     type: "STORY",
//     content:
//       "Maria is a university professor teaching biology. Her students love her interactive lectures and hands-on experiments. This semester, she's leading a research project about marine ecosystems.",
//   },
//   // Healthcare
//   {
//     id: "story-6",
//     type: "STORY",
//     content:
//       "Dr. James works at the city hospital as a pediatrician. He enjoys helping children and making them feel comfortable during their visits. His office is decorated with colorful pictures and toys.",
//   },
// ];

// const quizQuestions: QuizQuestion[] = [
//   // Tech & Business Questions
//   {
//     type: "MULTIPLE_CHOICE",
//     question: "What does John do for a living?",
//     preludeID: "story-1",
//     choices: [
//       "He is a software developer",
//       "He is a teacher",
//       "He is a chef",
//       "He is a doctor",
//     ],
//   },
//   {
//     type: "TRUE_FALSE",
//     question: "John works alone and never collaborates with a team.",
//     preludeID: "story-1",
//     choices: ["True", "False"],
//   },
//   {
//     type: "FILL_WRITE",
//     question: "John works at a _____ company.",
//     preludeID: "story-1",
//   },

//   // Culinary Questions
//   {
//     type: "MULTIPLE_CHOICE",
//     question: "What type of cuisine is Sarah's specialty?",
//     preludeID: "story-2",
//     choices: [
//       "Italian cuisine",
//       "French cuisine",
//       "Chinese cuisine",
//       "Mexican cuisine",
//     ],
//   },
//   {
//     type: "FILL_CHOICE",
//     question: "Sarah creates _____ dishes using fresh ingredients.",
//     preludeID: "story-2",
//     choices: ["delicious", "expensive", "simple", "basic"],
//   },
//   {
//     type: "TEXT_INPUT_WRITE",
//     question: "What does Sarah love to do besides cooking?",
//     preludeID: "story-2",
//   },

//   // Travel Questions
//   {
//     type: "MULTIPLE_CHOICE",
//     question: "Where did Emma start her European journey?",
//     preludeID: "story-3",
//     choices: ["Paris", "Rome", "London", "Madrid"],
//   },
//   {
//     type: "MATCHING",
//     question: "Match the cities with their attractions",
//     preludeID: "story-3",
//     items: ["Paris", "Rome"],
//     secondItems: ["Eiffel Tower", "Ancient ruins"],
//   },
//   {
//     type: "ORDERING",
//     question: "Order Emma's travel activities in sequence",
//     preludeID: "story-3",
//     items: [
//       "Visit Eiffel Tower",
//       "Try French cuisine",
//       "Travel to Rome",
//       "Try Italian pizza",
//     ],
//   },

//   // Daily Life Questions
//   {
//     type: "MULTIPLE_CHOICE",
//     question: "Where does David go for his morning exercise?",
//     preludeID: "story-4",
//     choices: [
//       "In the nearby park",
//       "At a gym",
//       "On the beach",
//       "In his apartment",
//     ],
//   },
//   {
//     type: "ORDERING",
//     question: "Order David's morning routine",
//     preludeID: "story-4",
//     items: [
//       "Wake up early",
//       "Go jogging",
//       "Prepare breakfast",
//       "Read the news",
//     ],
//   },
//   {
//     type: "TEXT_INPUT_WRITE",
//     question: "Where does David live?",
//     preludeID: "story-4",
//   },

//   // Education Questions
//   {
//     type: "MULTIPLE_CHOICE",
//     question: "What subject does Maria teach?",
//     preludeID: "story-5",
//     choices: ["Biology", "Chemistry", "Physics", "Mathematics"],
//   },
//   {
//     type: "FILL_CHOICE",
//     question: "Maria's lectures are _____.",
//     preludeID: "story-5",
//     choices: ["interactive", "boring", "short", "cancelled"],
//   },
//   {
//     type: "TEXT_INPUT_WRITE",
//     question: "What is Maria's current research project about?",
//     preludeID: "story-5",
//   },

//   // Healthcare Questions
//   {
//     type: "MULTIPLE_CHOICE",
//     question: "What type of doctor is Dr. James?",
//     preludeID: "story-6",
//     choices: ["Pediatrician", "Surgeon", "Dentist", "Cardiologist"],
//   },
//   {
//     type: "TRUE_FALSE",
//     question: "Dr. James's office is plain and without decorations.",
//     preludeID: "story-6",
//     choices: ["True", "False"],
//   },
//   {
//     type: "FILL_CHOICE",
//     question: "Dr. James helps _____ feel comfortable during their visits.",
//     preludeID: "story-6",
//     choices: ["children", "adults", "elderly", "patients"],
//   },

//   // General Language Skills Questions
//   {
//     type: "MATCHING",
//     question: "Match the professions with their workplaces",
//     items: ["Doctor", "Teacher", "Chef", "Developer"],
//     secondItems: ["Hospital", "School", "Restaurant", "Tech Company"],
//   },
//   {
//     type: "ORDERING",
//     question: "Order these daily activities from morning to night",
//     items: [
//       "Wake up",
//       "Have breakfast",
//       "Go to work",
//       "Have lunch",
//       "Return home",
//       "Sleep",
//     ],
//   },
//   {
//     type: "FILL_CHOICE",
//     question: "The weather is _____ today, perfect for a walk in the park.",
//     choices: ["beautiful", "terrible", "boring", "difficult"],
//   },
//   {
//     type: "MULTIPLE_CHOICE",
//     question: "Which sentence is grammatically correct?",
//     choices: [
//       "She works at a hospital",
//       "She work at a hospital",
//       "She working at a hospital",
//       "She worked at hospital",
//     ],
//   },
//   {
//     type: "TEXT_INPUT_WRITE",
//     question: "Write a sentence using the words: travel, exciting, adventure",
//   },
// ];

// export class MockAIModel extends AIModel {
//   constructor() {
//     super();
//   }

//   async _init(): Promise<void> {
//     // Mock init logic
//   }

//   async _generateQuiz(args: {
//     userPath: WithId<IUserPath>;
//     journey: WithId<IJourney>;
//   }): Promise<AIGeneratedContentResponse<QuizDetails>> {
//     // Rastgele bir prelude seç
//     const prelude =
//       quizPreludes[Math.floor(Math.random() * quizPreludes.length)];

//     // Prelude'a ait soruları ve diğer soruları karıştır
//     const preludeQuestions = quizQuestions.filter(
//       (q) => q.preludeID === prelude.id
//     );

//     // Genel sorulardan rastgele 3 tane seç
//     const generalQuestions = quizQuestions
//       .filter((q) => !q.preludeID)
//       .sort(() => Math.random() - 0.5)
//       .slice(0, 3);

//     const selectedQuestions = [...preludeQuestions, ...generalQuestions];

//     // Soruları karıştır
//     const shuffledQuestions = selectedQuestions.sort(() => Math.random() - 0.5);

//     return {
//       content: {
//         questions: shuffledQuestions,
//         preludes: [prelude],
//         type: "QUIZ",
//       },
//       metadata: {
//         avatar: randomColor(),
//         title: "Comprehensive Language Skills Quiz",
//         description:
//           "Test your language skills with this interactive quiz covering various real-life scenarios",
//         tags: [
//           "grammar",
//           "vocabulary",
//           "comprehension",
//           "real-life",
//           "interactive",
//         ],
//         estimatedDuration: 20,
//         focusAreas: [
//           "reading",
//           "comprehension",
//           "vocabulary",
//           "grammar",
//           "writing",
//         ],
//       },
//     };
//   }
//   readonly name = "mock";
// }

// export default MockAIModel;
