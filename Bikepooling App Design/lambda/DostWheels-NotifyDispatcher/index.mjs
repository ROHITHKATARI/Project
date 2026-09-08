import {
    SSMClient,
    GetParameterCommand
} from "@aws-sdk/client-ssm";

import {
    DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    QueryCommand,
    PutCommand
} from "@aws-sdk/lib-dynamodb";

import {
    initializeApp,
    cert,
    getApps
} from "firebase-admin/app";

import {
    getMessaging
} from "firebase-admin/messaging";

const REGION = "ap-south-1";

const DEVICES_TABLE = "dostwheels-notification-devices";

const NOTIFICATIONS_TABLE = "dostwheels-notifications";

const FIREBASE_PARAMETER =
    "/dostwheels/firebase/service-account";

const ssmClient = new SSMClient({
    region: REGION
});

const dynamoClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: REGION
    })
);

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK using the
 * service-account JSON stored in AWS SSM.
 */
async function initializeFirebase() {
    if (firebaseInitialized) {
        return;
    }

    const response = await ssmClient.send(
        new GetParameterCommand({
            Name: FIREBASE_PARAMETER,
            WithDecryption: true
        })
    );

    const parameterValue = response.Parameter?.Value;

    if (!parameterValue) {
        throw new Error(
            "Firebase service-account parameter is empty"
        );
    }

    const serviceAccount = JSON.parse(parameterValue);

    if (getApps().length === 0) {
        initializeApp({
            credential: cert(serviceAccount)
        });
    }

    firebaseInitialized = true;

    console.log(
        "Firebase Admin initialized successfully"
    );

    console.log(
        "Firebase project:",
        serviceAccount.project_id
    );
}

/**
 * Get all active Android devices belonging
 * to the ride owner.
 */
async function getActiveDevices(userId) {
    const response = await dynamoClient.send(
        new QueryCommand({
            TableName: DEVICES_TABLE,

            KeyConditionExpression:
                "userId = :userId",

            ExpressionAttributeValues: {
                ":userId": userId
            }
        })
    );

    const devices = (response.Items || []).filter(
        (device) =>
            device.status === "active" &&
            device.platform === "android" &&
            typeof device.token === "string" &&
            device.token.length > 0
    );

    return devices;
}

/**
 * Write a notification record to DynamoDB.
 *
 * Uses a deterministic notificationId and a
 * ConditionExpression to ensure idempotency.
 *
 * Returns { created: true } on first write,
 * { created: false } if the record already
 * exists (stream re-delivery / duplicate).
 *
 * Throws on unexpected DynamoDB errors.
 */
async function writeNotificationRecord(record) {
    try {
        await dynamoClient.send(
            new PutCommand({
                TableName: NOTIFICATIONS_TABLE,
                Item: record,
                ConditionExpression:
                    "attribute_not_exists(notificationId)"
            })
        );

        console.log(
            "Notification record created:",
            record.notificationId
        );

        return { created: true };

    } catch (error) {
        if (
            error?.name ===
            "ConditionalCheckFailedException"
        ) {
            console.log(
                "Notification record already exists",
                "(idempotent skip):",
                record.notificationId
            );

            return { created: false };
        }

        throw error;
    }
}

/**
 * Send one FCM notification to one device.
 *
 * Accepts a generic payload to support
 * multiple notification types in the future.
 */
async function sendPushNotification({
    token,
    title,
    body,
    dataFields,
    channelId
}) {
    const message = {
        token,

        notification: {
            title,
            body
        },

        data: dataFields,

        android: {
            priority: "high",

            notification: {
                channelId:
                    channelId || "dostwheels_alerts"
            }
        }
    };

    const messageId = await getMessaging().send(
        message
    );

    return messageId;
}

/**
 * Process DynamoDB Stream records.
 */
export const handler = async (event) => {
    console.log(
        "=== DostWheels NotifyDispatcher ==="
    );

    console.log(
        `Received ${event.Records?.length || 0} stream record(s)`
    );

    await initializeFirebase();

    for (const record of event.Records || []) {
        console.log(
            "Processing event:",
            record.eventName
        );

        /**
         * Ride requests modify an existing ride.
         * INSERT is ride creation, so ignore it.
         */
        if (record.eventName !== "MODIFY") {
            continue;
        }

        const newImage =
            record.dynamodb?.NewImage || {};

        const oldImage =
            record.dynamodb?.OldImage || {};

        const rideId =
            newImage.rideId?.S;

        const ownerId =
            newImage.userId?.S;

        /**
         * Read pending request IDs from the
         * old and new versions of the ride.
         */
        const oldPendingIds =
            oldImage.pendingRequestIds?.L || [];

        const newPendingIds =
            newImage.pendingRequestIds?.L || [];

        const oldIds = new Set(
            oldPendingIds
                .map((item) => item?.S)
                .filter(Boolean)
        );

        const newIds =
            newPendingIds
                .map((item) => item?.S)
                .filter(Boolean);

        /**
         * Find only requesters that were added
         * by this MODIFY event.
         */
        const newlyAddedIds =
            newIds.filter(
                (id) => !oldIds.has(id)
            );

        if (
            !rideId ||
            !ownerId ||
            newlyAddedIds.length === 0
        ) {
            console.log(
                "No new ride request detected."
            );

            continue;
        }

        console.log(
            ">>> NEW RIDE REQUEST DETECTED <<<"
        );

        console.log(
            "Ride ID:",
            rideId
        );

        console.log(
            "Owner ID:",
            ownerId
        );

        console.log(
            "New requester count:",
            newlyAddedIds.length
        );

        /**
         * Find the owner's active Android devices.
         */
        const devices =
            await getActiveDevices(ownerId);

        console.log(
            "Active Android devices found:",
            devices.length
        );

        if (devices.length === 0) {
            console.log(
                "No active Android device found for owner."
            );

            continue;
        }

        /**
         * pendingRequestNames is expected to
         * correspond to pendingRequestIds by index.
         */
        const pendingNames =
            newImage.pendingRequestNames?.L || [];

        /**
         * Extract ride origin and destination
         * from the stream NewImage for the
         * notification body and data fields.
         */
        const rideFrom =
            newImage.from?.S || "origin";

        const rideTo =
            newImage.to?.S || "destination";

        for (
            const requesterId of newlyAddedIds
        ) {
            const requesterIndex =
                newIds.indexOf(requesterId);

            const requesterName =
                pendingNames[requesterIndex]?.S ||
                "Someone";

            console.log(
                "Sending notification for requester:",
                requesterId
            );

            console.log(
                "Requester name:",
                requesterName
            );

            /**
             * Deterministic notificationId for
             * idempotent persistence. Matches
             * the format used by the client-side
             * syncRideRequestNotifications().
             */
            const notificationId =
                `RRREQ#${rideId}#${requesterId}`;

            /**
             * Persist the notification record
             * to dostwheels-notifications.
             *
             * Uses ConditionExpression to skip
             * if the record already exists
             * (stream re-delivery / retry).
             *
             * FCM send proceeds regardless of
             * whether this write succeeds or
             * is skipped.
             */
            const notificationTitle =
                "New Ride Request";

            const notificationBody =
                `${requesterName} requested to join` +
                ` your ride from ${rideFrom}` +
                ` to ${rideTo}.`;

            try {
                await writeNotificationRecord({
                    userId: ownerId,
                    notificationId,
                    type: "RIDE_REQUEST_RECEIVED",
                    title: notificationTitle,
                    body: notificationBody,
                    read: false,
                    createdAt:
                        new Date().toISOString(),
                    senderId: requesterId,
                    senderName: requesterName,
                    rideId,
                    data: {
                        rideId,
                        requesterId,
                        from: rideFrom,
                        to: rideTo
                    }
                });
            } catch (writeError) {
                console.error(
                    "Notification write failed",
                    "(non-fatal, continuing to FCM):",
                    writeError?.message || writeError
                );
            }

            /**
             * Send FCM push to all active devices.
             *
             * This runs unconditionally — even if
             * the DynamoDB write was skipped or
             * failed — so that stream retries can
             * re-attempt FCM delivery.
             */
            for (const device of devices) {
                try {
                    const messageId =
                        await sendPushNotification({
                            token: device.token,

                            title: notificationTitle,

                            body:
                                `${requesterName}` +
                                ` requested to join` +
                                ` your ride.`,

                            dataFields: {
                                type:
                                    "RIDE_REQUEST_RECEIVED",
                                notificationId,
                                rideId:
                                    String(rideId),
                                senderId:
                                    String(requesterId),
                                senderName:
                                    String(requesterName)
                            },

                            channelId:
                                "dostwheels_alerts"
                        });

                    console.log(
                        "FCM push sent successfully."
                    );

                    console.log(
                        "Device ID:",
                        device.deviceId
                    );

                    console.log(
                        "FCM message ID:",
                        messageId
                    );

                } catch (error) {
                    console.error(
                        "FCM push failed."
                    );

                    console.error(
                        "Device ID:",
                        device.deviceId
                    );

                    console.error(
                        "Error:",
                        error?.message || error
                    );
                }
            }
        }
    }

    console.log(
        "=== Notification dispatch completed ==="
    );

    return {
        statusCode: 200,
        body: "Notification dispatch completed"
    };
};