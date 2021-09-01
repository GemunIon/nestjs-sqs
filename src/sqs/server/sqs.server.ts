import { Injectable, Logger } from "@nestjs/common";
import { CustomTransportStrategy, MessageHandler, Server } from "@nestjs/microservices";
import { SQS } from "aws-sdk";
import { Consumer, SQSMessage } from "sqs-consumer";
import { EMPTY, Observable } from "rxjs";
import { ISqsClientOptions, ISqsServerOptions } from "../interfaces";
import { SqsSerializer } from "./sqs.serializer";
import { SqsDeserializer } from "./sqs.deserializer";

@Injectable()
export class SqsServer extends Server implements CustomTransportStrategy {
  protected readonly logger = new Logger(SqsServer.name);

  private sqs: SQS;
  private consumer: Consumer;

  constructor(protected readonly options: ISqsServerOptions["options"]) {
    super();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public createClient(): void {
    this.consumer = Consumer.create({
      ...this.options,
      sqs: this.sqs,
      handleMessage: this.handleMessage.bind(this),
      handleMessageBatch: this.handleMessageBatch.bind(this),
    });
  }

  public async handleMessage(message: SQSMessage): Promise<void> {
    await this.call("name", message);
  }

  public async handleMessageBatch(messages: Array<SQSMessage>): Promise<void> {
    for (const message of messages) {
      await this.handleMessage(message);
    }
  }

  public listen(callback: () => void): void {
    this.createClient();
    this.consumer.start();
    callback();
  }

  private call(pattern: string, data: any): Promise<Observable<any>> {
    const handler: MessageHandler | undefined = this.messageHandlers.get(pattern);

    if (!handler) {
      return Promise.resolve(EMPTY);
    }

    return handler(data);
  }

  public close(): void {
    this.consumer.stop();
  }

  protected initializeSerializer(options: ISqsClientOptions["options"]): void {
    this.serializer = options?.serializer ?? new SqsSerializer();
  }

  protected initializeDeserializer(options: ISqsClientOptions["options"]): void {
    this.deserializer = options?.deserializer ?? new SqsDeserializer();
  }
}