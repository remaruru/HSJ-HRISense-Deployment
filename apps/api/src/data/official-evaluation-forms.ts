/**
 * Hospicio de San Jose's official employee performance evaluation forms.
 *
 * GENERATED — do not edit the wording by hand. The review areas, statements,
 * instructions, labels and acknowledgment text below were extracted from the
 * Word documents HR supplied (EVAL FORM 1–4.docx and "SIMPLIFIED EVALUATIONfor
 * Coordinators.docx") by scripts/evaluation/extract_official_forms.py; only line
 * wraps, spacing, list numbering and two stray backticks were normalised.
 * scripts/evaluation/verify_official_forms.ts re-checks them against the files.
 *
 * Not from the forms (HRISense configuration, editable by HR):
 *   - `roleCodes`: the current job roles each form is mapped to — only where the
 *     role clearly is the group Hospicio named (see the seed script's notes);
 *   - area weights on Forms 1–4: the paper forms print none, so HRISense starts
 *     them at an equal split (`weightsSource: 'HRISENSE_EQUAL'`).
 * The Simplified form's scoring is its own printed rule (`FORM_FORMULA`):
 * each factor's total ÷ 3 = its average; the sum of the averages ÷ 10 = overall.
 */

export type OfficialScaleId = 'HSJ_EPR' | 'HSJ_SIMPLIFIED';

export interface OfficialScaleOption {
  score: number;
  /** The code printed on the form (Forms 1–4: U, F, G, VG, E). */
  code?: string;
  label: string;
}

/** The two rating scales, exactly as printed. */
export const OFFICIAL_SCALES: Record<OfficialScaleId, OfficialScaleOption[]> = {
  HSJ_EPR: [
    { score: 1, code: 'U', label: 'Unsatisfactory' },
    { score: 2, code: 'F', label: 'Fair' },
    { score: 3, code: 'G', label: 'Good' },
    { score: 4, code: 'VG', label: 'Very Good' },
    { score: 5, code: 'E', label: 'Excellent' },
  ],
  HSJ_SIMPLIFIED: [
    { score: 1, label: 'Unsatisfactory' },
    { score: 2, label: 'Improvement Needed' },
    { score: 3, label: 'Satisfactory' },
    { score: 4, label: 'Very Satisfactory' },
    { score: 5, label: 'Exceptional' },
  ],
};

export interface OfficialFormLayout {
  instructions: string[];
  appraisalLabel: string;
  appraisalTypes: string[];
  overallLabel: string;
  generalCommentsLabel: string;
  goalsLabel: string | null;
  goalsPrompt: string | null;
  acknowledgment: string | null;
  itemComments: boolean;
  itemMarker: ')' | '.';
  weightsSource: 'HRISENSE_EQUAL' | 'FORM_FORMULA';
}

export interface OfficialEvaluationForm {
  code: string;
  name: string;
  formCode: string;
  sourceDocument: string;
  appliesTo: string[];
  roleCodes: string[];
  scale: OfficialScaleId;
  scoringMethod: 'AREA_WEIGHTED' | 'AREA_AVERAGE';
  layout: OfficialFormLayout;
  areas: Array<{ name: string; items: string[] }>;
}

export const OFFICIAL_EVALUATION_FORMS: OfficialEvaluationForm[] = [
  {
    "code": "HSJ_EPR_FORM_1",
    "name": "Eval Form 1",
    "formCode": "EPRForm1",
    "sourceDocument": "EVAL FORM 1.docx",
    "appliesTo": [
      "Laundry",
      "Janitorial",
      "Maintenance",
      "Cook",
      "Drivers"
    ],
    "roleCodes": [
      "LAUNDRY_STAFF",
      "JANITORIAL_STAFF",
      "MAINTENANCE_STAFF",
      "KITCHEN_STAFF",
      "DRIVER"
    ],
    "scale": "HSJ_EPR",
    "scoringMethod": "AREA_WEIGHTED",
    "layout": {
      "instructions": [
        "Instructions: Complete this form and go over each factor with the employee. Make suggestions for future improvement where necessary. Submit this report to the HRD office for employee’s file and reference.",
        "Evaluation Codes: Use the following codes to determine the employee’s performance for each review area.",
        "U- Unsatisfactory; F- Fair; G – Good; VG – Very Good; E - Excellent. Place √ in the column under the appropriate rating."
      ],
      "appraisalLabel": "Nature of Appraisal",
      "overallLabel": "Overall Performance",
      "generalCommentsLabel": "Additional Comments",
      "goalsLabel": "Goals and Objectives",
      "goalsPrompt": "What are the specific activities or areas that the employee need to accomplish/improve during the next review period.",
      "acknowledgment": "My head/coordinator have discussed this review to me. By signing this form does not necessarily indicate that I agree with the evaluation",
      "itemComments": true,
      "appraisalTypes": [
        "Regularization",
        "Mid-Year / Annual Review"
      ],
      "itemMarker": ")",
      "weightsSource": "HRISENSE_EQUAL"
    },
    "areas": [
      {
        "name": "KNOWLEDGE, SKILLS & ABILITIES",
        "items": [
          "Has practical/technical skills and knowledge in doing the assigned job.",
          "Performs work with less instruction and supervision.",
          "Follows and uses proper tools, methods and work procedures.",
          "Articulates and displays understanding of HSJ vision, mission and goals in the job."
        ]
      },
      {
        "name": "QUALITY AND QUANTITY OF WORK",
        "items": [
          "Accomplishes work neatly, orderly and accurately.",
          "Accepts work assignments willingly.",
          "Successfully fulfills the required daily duties and responsibilities.",
          "Patiently and effectively assists / respond to requests and needs of other departments.",
          "Manages time, organize work well and sets priorities."
        ]
      },
      {
        "name": "INITIATIVE AND DEPENDABILITY",
        "items": [
          "Find new and better ways to do the assigned work.",
          "Does what needs to be done without being told.",
          "Takes initiative in assuming other job responsibilities esp. in the absence of colleagues."
        ]
      },
      {
        "name": "COMMUNICATION",
        "items": [
          "Informs and coordinate matters requiring immediate attention to co-workers /heads.",
          "Demonstrates courtesy and tact in dealing with people.",
          "Maintains confidentiality of information affecting the institution and residents."
        ]
      },
      {
        "name": "JUDGMENT & PROBLEM SOLVING",
        "items": [
          "Uses good judgment and common-sense approach in solving problems.",
          "Seeks assistance from head and co-workers when problem occurs or when necessary",
          "Considers constructive criticism and makes necessary change in performance."
        ]
      },
      {
        "name": "INTERPERSONAL SKILLS",
        "items": [
          "Shares talents and ideas for betterment of the service.",
          "Participates in staff meetings, holy mass, rosary and other liturgical /social activities.",
          "Gets along well with others and establish effective relationship with colleagues and heads.",
          "Respectful and courteous in dealing with co-workers, visitors, residents and superiors"
        ]
      },
      {
        "name": "PERSONAL ATTRIBUTES",
        "items": [
          "Responsible, industrious and approachable.",
          "Presentable and wears prescribed uniform /attire while on duty.",
          "Honest, truthful, humble and simple.",
          "Generously extends duty hours when necessary.",
          "Practices professionalism, good moral values and work ethics."
        ]
      },
      {
        "name": "FLEXIBILITY",
        "items": [
          "Analyzes, understands and adapts well to change, new policies, information and situations.",
          "Shows willingness to learn new tasks and procedures and is open for suggestions.",
          "Easily adjusts and accepts changes in schedules and assignments."
        ]
      },
      {
        "name": "ATTENDANCE & PUNCTUALITY",
        "items": [
          "Always on time for work, meetings and conferences.",
          "Informs colleagues/superiors when leaving the workplace, absent or tardy",
          "Follows work schedules regularly.",
          "Attends seminars and training for personal and professional growth."
        ]
      },
      {
        "name": "COMMITMENT",
        "items": [
          "Keeps workplace and surroundings area clean and a smoke-free environment.",
          "Helps minimize waste and use recycled materials to save cost.",
          "Maintains the institution’s property and equipment in good condition.",
          "Exemplify Vincentian virtues in serving.",
          "Follows the institution’s policies, rules and regulations."
        ]
      }
    ]
  },
  {
    "code": "HSJ_EPR_FORM_2",
    "name": "Eval Form 2",
    "formCode": "EPRForm2",
    "sourceDocument": "EVAL FORM 2.docx",
    "appliesTo": [
      "Houseparents"
    ],
    "roleCodes": [],
    "scale": "HSJ_EPR",
    "scoringMethod": "AREA_WEIGHTED",
    "layout": {
      "instructions": [
        "Instructions: Complete this form and go over each factor with the employee. Make suggestions for future improvement where necessary. Submit this report to the HRD Office for employee’s file and reference.",
        "Evaluation Codes: Use the following codes to determine the employee’s performance for each review area.",
        "U- Unsatisfactory; F- Fair; G – Good; VG – Very Good; E - Excellent. Place √ in the column under the appropriate rating."
      ],
      "appraisalLabel": "Nature of Appraisal",
      "overallLabel": "Overall Performance",
      "generalCommentsLabel": "Additional Comments",
      "goalsLabel": "Goals and Objectives",
      "goalsPrompt": "What are the specific activities or areas which the employee needs to accomplish/improve during the next review period.",
      "acknowledgment": "My supervisor/head discussed this review to me. By signing this form does not necessarily indicate that I agree with the evaluation.",
      "itemComments": true,
      "appraisalTypes": [
        "Regularization",
        "Mid-Year / Annual Review"
      ],
      "itemMarker": ")",
      "weightsSource": "HRISENSE_EQUAL"
    },
    "areas": [
      {
        "name": "KNOWLEDGE, SKILLS & ABILITIES",
        "items": [
          "Has practical/technical skills and knowledge in giving care and managing children or adults.",
          "Performs work with less instruction and supervision.",
          "Follows and uses proper methods and work procedures.",
          "Articulates and displays understanding and application of HSJ vision, mission and goals in the job."
        ]
      },
      {
        "name": "QUALITY AND QUANTITY OF WORK",
        "items": [
          "Undertakes daily living activities willingly, orderly and accurately.",
          "Successfully fulfill the required daily duties and responsibilities.",
          "Patiently and effectively assists / respond to requests and immediate needs of clients.",
          "Manages time, organize work well and sets priorities."
        ]
      },
      {
        "name": "INITIATIVE AND DEPENDABILITY",
        "items": [
          "Participates and suggests in the planning and implementation of program/activities.",
          "Finds new and better ways to meet changing needs of clients and attends seminars for self-growth.",
          "Does what needs to be done without being told.",
          "Takes initiative in assuming complex assignments and developmental activities esp. in the absence of colleagues."
        ]
      },
      {
        "name": "COMMUNICATION",
        "items": [
          "Informs and coordinate matters requiring immediate attention to supervisors/co-workers.",
          "Demonstrates courtesy and tact in dealing with people.",
          "Writes and conveys incident reports, observations and endorsements clearly and correctly.",
          "Maintains confidentiality of information affecting the institution and clients."
        ]
      },
      {
        "name": "JUDGMENT & PROBLEM SOLVING",
        "items": [
          "Uses good judgment and makes sound decisions to solve problems effectively.",
          "Seeks assistance from head and co-workers when problem occurs or when necessary",
          "Considers constructive criticism and makes necessary change in performance."
        ]
      },
      {
        "name": "INTERPERSONAL SKILLS",
        "items": [
          "Shares talents and ideas for betterment of the service.",
          "Attends staff meetings, holy mass and other liturgical/social activities.",
          "Gets along well with others and establish effective relationship with colleagues and supervisors/heads.",
          "Respectful and courteous in dealing with co-workers, visitors, residents and superiors."
        ]
      },
      {
        "name": "PERSONAL ATTRIBUTES",
        "items": [
          "Gentle, approachable and responsible.",
          "Wears prescribed uniform /attire while on duty.",
          "Honest, truthful, humble and simple.",
          "Generously extends duty hours when necessary.",
          "Practices professionalism, good moral values and work ethics."
        ]
      },
      {
        "name": "FLEXIBILITY",
        "items": [
          "Analyzes, understands and adapts well to change, new policies, information and situations.",
          "Shows willingness to learn new tasks or procedures and is open for suggestions.",
          "Easily adjusts and accepts changes in duty schedules.",
          "Welcomes transfer in job assignments."
        ]
      },
      {
        "name": "ATTENDANCE & PUNCTUALITY",
        "items": [
          "Always arrives on time for work, meetings and conferences",
          "Informs co-workers / supervisors when leaving the workplace, absent and tardy.",
          "Follows work schedules regularly.",
          "Files and uses leave credits accordingly."
        ]
      },
      {
        "name": "COMMITMENT",
        "items": [
          "Always keeps surroundings and work area clean.",
          "Helps minimize waste and use recycled materials to save cost.",
          "Maintains the institution’s property and equipment in good condition.",
          "Exemplify Vincentian virtues in serving.",
          "Follows the institution’s policies, rules and regulations."
        ]
      }
    ]
  },
  {
    "code": "HSJ_EPR_FORM_3",
    "name": "Eval Form 3",
    "formCode": "EPRForm3",
    "sourceDocument": "EVAL FORM 3.docx",
    "appliesTo": [
      "Health",
      "Office Staff / Secretaries",
      "Accounting",
      "Information"
    ],
    "roleCodes": [
      "PT_STAFF",
      "ADMIN_SEC",
      "ACCOUNTING_STAFF"
    ],
    "scale": "HSJ_EPR",
    "scoringMethod": "AREA_WEIGHTED",
    "layout": {
      "instructions": [
        "Instructions: Complete this form and go over each factor with the employee. Make suggestions for future improvement where necessary. Submit this report to the HRD office for employee’s file and reference.",
        "Evaluation Codes: Use the following codes to determine the employee’s performance for each review area.",
        "U- Unsatisfactory; F- Fair; G – Good; VG – Very Good; E - Excellent. Place √ in the column under the appropriate rating."
      ],
      "appraisalLabel": "Nature of Appraisal",
      "overallLabel": "Overall Performance",
      "generalCommentsLabel": "Additional Comments",
      "goalsLabel": "Goals and Objectives",
      "goalsPrompt": "What are the specific activities / areas which the employee need to accomplish or improve during the next review period.",
      "acknowledgment": "My supervisor/head have discussed this review to me. By signing this form does not necessarily indicate that I agree with the evaluation.",
      "itemComments": true,
      "appraisalTypes": [
        "Regularization",
        "Mid-Year / Annual Review"
      ],
      "itemMarker": ")",
      "weightsSource": "HRISENSE_EQUAL"
    },
    "areas": [
      {
        "name": "KNOWLEDGE, SKILLS & ABILITIES",
        "items": [
          "Possesses thorough knowledge, skills and abilities to perform the job and other work assignments.",
          "Makes high quality decisions or suggestions that contribute to the betterment of the service.",
          "Helps create new methods and procedures to improve work flow or services.",
          "Articulates and displays understanding and application of HSJ vision, mission and goals in the job."
        ]
      },
      {
        "name": "QUALITY AND QUANTITY OF WORK",
        "items": [
          "Work output is reliable and performs tasks with less instruction, supervision and free of errors.",
          "Meets work deadlines and schedules.",
          "Accomplishes work neatly, orderly and accurately according to established procedures.",
          "Manages time, organize work well and sets priorities."
        ]
      },
      {
        "name": "INITIATIVE AND CREATIVITY",
        "items": [
          "Adapts new methods and procedures to get the job done effectively and accurately.",
          "Assumes more complex work assignments especially in the absence of colleagues or co-workers.",
          "Participates and suggests in the planning and implementation of program/activities."
        ]
      },
      {
        "name": "COMMUNICATION",
        "items": [
          "Informs and coordinate matters requiring immediate attention to supervisors/co-workers.",
          "Demonstrates courtesy and tact in dealing to ALL.",
          "Maintains confidentiality of information affecting the institution and clients.",
          "Gives honest feedback of situations and information to others."
        ]
      },
      {
        "name": "JUDGMENT & DEPENDABILITY",
        "items": [
          "Uses good judgment and makes sound decisions to solve problems effectively.",
          "Analyzes and understand new situations/ information and adapts well to change.",
          "Seeks assistance from head and co-workers when problem occurs or when necessary",
          "Works independently and able to perform other job responsibilities as assigned."
        ]
      },
      {
        "name": "INTERPERSONAL SKILLS",
        "items": [
          "Collaborates and works well with other staff members in the fulfillment of the institution’s vision, mission and goals.",
          "Attends staff meetings, holy mass, rosary and other cultural and liturgical activities.",
          "Respectful and courteous in dealing with co-workers, visitors, residents and superiors"
        ]
      },
      {
        "name": "PERSONAL ATTRIBUTES",
        "items": [
          "Is generally a person of good moral character, gentle, humble, simple and courteous to ALL.",
          "Wears prescribed uniform /attire in reporting to work.",
          "Generous in giving extra duty hours when necessary.",
          "Demonstrates professionalism in behavior, appearance and communication."
        ]
      },
      {
        "name": "FLEXIBILITY & ADAPTABILITY",
        "items": [
          "Understands and adapts well to change, new Information and situations.",
          "Shows willingness to learn new tasks or procedures and is open for suggestions.",
          "Welcomes transfer and new work assignments.",
          "Considers constructive criticism and makes necessary change in performance."
        ]
      },
      {
        "name": "ATTENDANCE & PUNCTUALITY",
        "items": [
          "Always arrive on time for work, meetings and conferences.",
          "Informs heads/co-workers when leaving the office, absent or tardy",
          "Follows work schedules regularly and observes the allotted time for breaks."
        ]
      },
      {
        "name": "COMMITMENT",
        "items": [
          "Always keep the surroundings and work area neat and clean.",
          "Shows unwavering support towards the realization of the vision and mission of the institution.",
          "Exemplify Vincentian virtues in dealing with people/residents/workers.",
          "Consistently follows the established policies, rules and regulations of the institution."
        ]
      }
    ]
  },
  {
    "code": "HSJ_EPR_FORM_4",
    "name": "Eval Form 4",
    "formCode": "EPRForm4",
    "sourceDocument": "EVAL FORM 4.docx",
    "appliesTo": [
      "Social Workers"
    ],
    "roleCodes": [
      "SOCIAL_WORKER"
    ],
    "scale": "HSJ_EPR",
    "scoringMethod": "AREA_WEIGHTED",
    "layout": {
      "instructions": [
        "Instructions: Complete this form and go over each factor with the employee. Make suggestions for future improvement where necessary. Submit this report to the HRD Office for employee’s file and reference.",
        "Evaluation Codes: Use the following codes to determine the employee’s performance for each review area.",
        "U- Unsatisfactory; F- Fair; G - Good; VG – Very Good; E - Excellent . Place √ in the column under the appropriate rating."
      ],
      "appraisalLabel": "Nature of Appraisal",
      "overallLabel": "Overall Performance",
      "generalCommentsLabel": "Additional Comments (if any)",
      "goalsLabel": "Goals and Objectives",
      "goalsPrompt": "What are the specific activities/areas the employee need to accomplish or improve during the next review period.",
      "acknowledgment": "My supervisor/head have discussed this review to me. By signing this form does not necessarily indicate that I agree with the evaluation.",
      "itemComments": true,
      "appraisalTypes": [
        "Regularization",
        "Mid-Year / Annual Review"
      ],
      "itemMarker": ")",
      "weightsSource": "HRISENSE_EQUAL"
    },
    "areas": [
      {
        "name": "KNOWLEDGE AND EXPERTISE",
        "items": [
          "Possesses and apply appropriate knowledge of SW practice and theory in the performance of the job.",
          "Makes high quality decisions or suggestions that contribute to the betterment of the service.",
          "Helps create new methods and procedures to improve work flow or services.",
          "Articulates and displays understanding and application of HSJ vision, mission and goals in the job."
        ]
      },
      {
        "name": "WORK OUTPUT",
        "items": [
          "Work output is reliable and performs tasks with less instruction, supervision and free of errors.",
          "Prepares and submits required and updated reports /documents within the specific period.",
          "Provides and implement services and/ or programs in an organized and timely manner.",
          "Responds willingly and patiently to client’s needs and problems."
        ]
      },
      {
        "name": "COMMUNICATION",
        "items": [
          "Communicates and reports information clearly and accurately both orally and in writing.",
          "Talk and listen to client and others to obtain relevant and detailed information."
        ]
      },
      {
        "name": "COLLABORATION",
        "items": [
          "Maintains positive working relationship with co-workers, supervisors and heads.",
          "Shares talents and ideas for the betterment and fulfillment of the vision, mission and service.",
          "Attends staff meetings, holy mass, rosary and other cultural and liturgical activities."
        ]
      },
      {
        "name": "PROFESSIONALISM",
        "items": [
          "Is a person of good moral values, respectful, humble, simple and courteous to ALL.",
          "Presentable in appearance and wears prescribed uniform /attire in reporting to work."
        ]
      },
      {
        "name": "INTERPERSONAL SKILLS",
        "items": [
          "Practices professional awareness and sensitivity and understands individual cultural abilities, similarities and differences.",
          "Collaborates and works well with other staff members."
        ]
      },
      {
        "name": "ATTENDANCE & PUNCTUALITY",
        "items": [
          "Always arrive on time for work, meetings and conferences.",
          "Informs supervisors when leaving the workplace, when absent or tardy.",
          "Follows work schedules regularly and observes allotted time for breaks."
        ]
      },
      {
        "name": "JUDGMENT & PROBLEM SOLVING SKILLS",
        "items": [
          "Considers constructive criticism and makes necessary change or improvement in the job.",
          "Clarify issues and concerns to parties concerned before making sound judgment and decisions.",
          "Understands and adapts well to change, new information and situations."
        ]
      },
      {
        "name": "PLANNING & ORGANIZING",
        "items": [
          "Is focus, detail oriented and completed tasks/project very well.",
          "Works calmly and effectively even under pressure or in difficult circumstances.",
          "Manages work priorities and makes the best use of time to accomplish multi-tasks."
        ]
      },
      {
        "name": "ETHICS",
        "items": [
          "Practices and apply social work standards and principles in dealing with clients and others.",
          "Manages personal beliefs and allows professional values in the service.",
          "Exemplify Vincentian virtues in dealing with people/residents/workers.",
          "Follows operating procedures, policies, rules and directives of the institution."
        ]
      }
    ]
  },
  {
    "code": "HSJ_SIMPLIFIED_SUPERVISORY",
    "name": "Simplified Evaluation for Coordinators, Supervisors, and Heads",
    "formCode": "Simplified",
    "sourceDocument": "SIMPLIFIED EVALUATIONfor Coordinators.docx",
    "appliesTo": [
      "Coordinators",
      "Supervisors",
      "Heads"
    ],
    "roleCodes": [
      "ASST_ADMIN",
      "PT_COORDINATOR",
      "JANITORIAL_SUPERVISOR",
      "KITCHEN_SUPERVISOR",
      "MAINTENANCE_SUPERVISOR",
      "HEAD_PCH",
      "CIP_COORDINATOR",
      "CY_COORDINATOR",
      "OP_COORDINATOR",
      "PSN_COORDINATOR",
      "HEAD_SSD",
      "IGP_COORDINATOR"
    ],
    "scale": "HSJ_SIMPLIFIED",
    "scoringMethod": "AREA_AVERAGE",
    "layout": {
      "instructions": [
        "Assign a following rating for each job performance and write the number in the corresponding column.",
        "= 5-Exceptional 4-Very Satisfactory 3-Satisfactory 2-Improvement Needed",
        "1-Unsatisfactory",
        "Get the total points for each number and divide by 3 to get the average. (Total divide by 3= Average)",
        "To get the overall performance rating, add the average score and divide by 10"
      ],
      "appraisalLabel": "Type of Evaluation",
      "overallLabel": "Overall Rating",
      "generalCommentsLabel": "Comments",
      "goalsLabel": null,
      "goalsPrompt": null,
      "acknowledgment": null,
      "itemComments": false,
      "appraisalTypes": [
        "1st Term",
        "2nd Term",
        "For Regularization",
        "For Annual"
      ],
      "itemMarker": ".",
      "weightsSource": "FORM_FORMULA"
    },
    "areas": [
      {
        "name": "QUALITY",
        "items": [
          "Work is accurate, precise and free of errors.",
          "Recognizes and corrects substandard workmanship or omissions.",
          "Express his/her thoughts clearly and correctly both verbally and in writing."
        ]
      },
      {
        "name": "WORK HABITS",
        "items": [
          "Completed assigned work within the day or specified period.",
          "Manages several responsibilities simultaneously.",
          "Utilize time, materials in equitable manner to achieve best possible results."
        ]
      },
      {
        "name": "JOB KNOWLEDGE",
        "items": [
          "Able to follow verbal and/or written instructions and uses proper procedures.",
          "Performs work without detailed instructions or supervision.",
          "Has practical / technical skills and knowledge to perform the job."
        ]
      },
      {
        "name": "RELIABILITY",
        "items": [
          "Do the job to the best of her/his ability and within standards.",
          "Puts in extra time and effort when necessary.",
          "Takes proper care of equipment and keeps work area clean and orderly."
        ]
      },
      {
        "name": "ATTENDANCE & PUNCTUALITY",
        "items": [
          "Arrives, start and depart from work according to schedule.",
          "Uses and file leave credits properly and calls to inform/explain absences.",
          "Attends meetings, formation sessions, Holy Mass and other institutional activities."
        ]
      },
      {
        "name": "INITIATIVE AND CREATIVITY",
        "items": [
          "Search new ideas, makes suggestions to improve work efficiency.",
          "Seeks out to help others or new assignment when finished with own work.",
          "View and act on problems and issues positively."
        ]
      },
      {
        "name": "TEAMWORK",
        "items": [
          "Willingly cooperates with other employees when the job requires.",
          "Sets an example with a positive and supportive attitude.",
          "Share ideas and information to become overall productive and effective."
        ]
      },
      {
        "name": "COMMITMENT",
        "items": [
          "Adheres/follows company policies and regulations.",
          "Practices proper safety procedures to protect self and clients.",
          "Clearly understand the institution’s goals/ objectives and proactive in offering support and services."
        ]
      },
      {
        "name": "PROBLEM SOLVING",
        "items": [
          "Analyzes problems and determines appropriate action for solutions.",
          "Readily volunteers to assume responsibility in the absence of staff/others.",
          "Seeks assistance and solicit opinions in doing things correctly."
        ]
      },
      {
        "name": "ADAPTABILITY",
        "items": [
          "Open to change, understand the situations before reacting negatively.",
          "Accepts comments and listens to others points of view for self-growth and work improvement.",
          "Able to respond quickly and properly in emergency/adverse situations."
        ]
      }
    ]
  }
];
