export interface FeedbackDataContent {
  feedback: string;
  selected_error: Array<number>;
  images: Array<string>;
}

export interface FeedbackData {
  rpi: FeedbackDataContent;
  router: FeedbackDataContent;
  tablet: FeedbackDataContent;
  content: FeedbackDataContent;
  app: FeedbackDataContent;
  general: FeedbackDataContent;

  [key: string]: FeedbackDataContent;
}

export interface IFeedbackImage {
    src: string;
}

export interface IFeedbackImagesSrc {
  rpi: Array<IFeedbackImage>;
  router: Array<IFeedbackImage>;
  tablet: Array<IFeedbackImage>;
  content: Array<IFeedbackImage>;
  app: Array<IFeedbackImage>;
  general: Array<IFeedbackImage>;
}
